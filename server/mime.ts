/**
 * Parser MIME mínimo para as mensagens de SendRawEmail (RawData do LocalStack).
 * Cobre o que aparece em e-mail transacional: multipart aninhado, RFC 2047 (assunto),
 * RFC 2231 (nome de arquivo), quoted-printable, base64, anexos e imagens cid:.
 */
import { Buffer } from 'node:buffer'
import type { MailHeader } from '../src/lib/types.ts'

export interface MimeFile {
  name: string
  type: string
  size: number
  cid: string
  inline: boolean
  data: Buffer
}

export interface ParsedMime {
  subject: string
  from: string
  to: string[]
  cc: string[]
  bcc: string[]
  replyTo: string[]
  text: string
  html: string
  files: MimeFile[]
  headers: MailHeader[]
}

type Headers = Record<string, string>

function unfold(head: string): string[] {
  return head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).filter(Boolean)
}

function headerList(head: string): MailHeader[] {
  const list: MailHeader[] = []
  for (const line of unfold(head)) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    list.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() })
  }
  return list
}

function parseHeaders(head: string): Headers {
  const h: Headers = {}
  for (const { name, value } of headerList(head)) {
    const k = name.toLowerCase()
    h[k] = h[k] ? `${h[k]}, ${value}` : value
  }
  return h
}

function toText(buf: Buffer, charset?: string): string {
  const cs = (charset || 'utf-8').toLowerCase().replace(/["']/g, '')
  if (/utf-?8/.test(cs)) return buf.toString('utf8')
  if (/8859-1|windows-1252|ascii|latin/.test(cs)) return buf.toString('latin1')
  try {
    return new TextDecoder(cs).decode(buf)
  } catch {
    return buf.toString('utf8')
  }
}

/** Uma string com caracteres acima de 0xFF já é texto decodificado, não bytes. */
const isDecoded = (s: string) => /[^\x00-\xff]/.test(s)
const bytes = (s: string) => (isDecoded(s) ? Buffer.from(s, 'utf8') : Buffer.from(s, 'binary'))

/** RFC 2047: =?UTF-8?B?...?= / =?UTF-8?Q?...?= */
export function decodeWords(str?: string): string {
  if (!str) return ''
  return String(str)
    .replace(/(=\?[^?]+\?[bqBQ]\?[^?]*\?=)\s+(?==\?)/g, '$1')
    .replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (all, cs: string, enc: string, txt: string) => {
      try {
        const buf =
          enc.toLowerCase() === 'b'
            ? Buffer.from(txt, 'base64')
            : Buffer.from(
                txt.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_m, x: string) => String.fromCharCode(parseInt(x, 16))),
                'binary',
              )
        return toText(buf, cs)
      } catch {
        return all
      }
    })
}

/** RFC 2231: %XX são bytes no charset declarado (não necessariamente UTF-8). */
const percentBytes = (s: string) =>
  Buffer.from(s.replace(/%([0-9a-f]{2})/gi, (_m, x: string) => String.fromCharCode(parseInt(x, 16))), 'binary')

/** "multipart/mixed; boundary=\"x\"" → { type, params } */
function parseContentType(value?: string): { type: string; params: Record<string, string> } {
  const [head, ...rest] = (value || 'text/plain').split(';')
  const params: Record<string, string> = {}
  for (const chunk of rest) {
    const i = chunk.indexOf('=')
    if (i < 0) continue
    const k = chunk.slice(0, i).trim().toLowerCase()
    let v = chunk.slice(i + 1).trim().replace(/^"|"$/g, '')
    if (k.endsWith('*')) {
      // filename*=UTF-8''nome%20x
      const m = v.match(/^([^']*)'[^']*'(.*)$/)
      try {
        v = m ? toText(percentBytes(m[2]), m[1]) : decodeURIComponent(v)
      } catch {
        // mantém o valor cru
      }
      params[k.slice(0, -1)] = v
    } else {
      params[k] = decodeWords(v)
    }
  }
  return { type: head.trim().toLowerCase(), params }
}

function qpDecode(str: string): Buffer {
  const clean = str.replace(/=\r?\n/g, '')
  const out: number[] = []
  for (let i = 0; i < clean.length; i++) {
    const hex = clean.slice(i + 1, i + 3)
    if (clean[i] === '=' && /^[0-9a-f]{2}$/i.test(hex)) {
      out.push(parseInt(hex, 16))
      i += 2
    } else {
      const c = clean.charCodeAt(i)
      if (c > 0xff) out.push(...Buffer.from(clean[i], 'utf8'))
      else out.push(c)
    }
  }
  return Buffer.from(out)
}

function decodeBody(body: string, cte?: string): Buffer {
  const enc = (cte || '7bit').toLowerCase().trim()
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64')
  if (enc === 'quoted-printable') return qpDecode(body)
  return bytes(body)
}

function splitEntity(entity: string): { head: string; headers: Headers; body: string } {
  const m = entity.match(/\r?\n\r?\n/)
  if (!m || m.index === undefined) return { head: entity, headers: parseHeaders(entity), body: '' }
  const head = entity.slice(0, m.index)
  return { head, headers: parseHeaders(head), body: entity.slice(m.index + m[0].length) }
}

function splitParts(body: string, boundary: string): string[] {
  const delim = `--${boundary}`
  const parts: string[] = []
  let cur: string[] | null = null
  for (const line of body.split(/\r?\n/)) {
    const t = line.trimEnd()
    if (t === delim || t === `${delim}--`) {
      if (cur) parts.push(cur.join('\r\n'))
      if (t.endsWith('--')) {
        cur = null
        break
      }
      cur = []
    } else if (cur) cur.push(line)
  }
  if (cur) parts.push(cur.join('\r\n'))
  return parts
}

/** Percorre a árvore MIME e recolhe corpo em texto, HTML e anexos. */
function walk(entity: string, out: Pick<ParsedMime, 'text' | 'html' | 'files'>): void {
  const { headers, body } = splitEntity(entity)
  const ct = parseContentType(headers['content-type'])
  const disp = parseContentType(headers['content-disposition'] || 'inline')

  if (ct.type.startsWith('multipart/')) {
    const b = ct.params.boundary
    if (!b) return
    for (const part of splitParts(body, b)) walk(part, out)
    return
  }

  const filename = disp.params.filename || ct.params.name
  const isAttachment = disp.type === 'attachment' || (!!filename && !ct.type.startsWith('text/'))
  const cte = headers['content-transfer-encoding']

  if (!isAttachment && ct.type === 'text/html' && !out.html) {
    out.html = toText(decodeBody(body, cte), ct.params.charset)
  } else if (!isAttachment && ct.type === 'text/plain' && !out.text) {
    out.text = toText(decodeBody(body, cte), ct.params.charset)
  } else if (ct.type !== 'text/plain' || filename) {
    const data = decodeBody(body, cte)
    out.files.push({
      name: decodeWords(filename) || `anexo-${out.files.length + 1}`,
      type: ct.type,
      size: data.length,
      cid: (headers['content-id'] || '').replace(/^<|>$/g, ''),
      inline: disp.type === 'inline',
      data,
    })
  }
}

/** Separa por vírgula sem quebrar nomes entre aspas ("Silva, Ana" <ana@x>). */
function addrs(v?: string): string[] {
  return (decodeWords(v || '').match(/(?:"[^"]*"|[^,])+/g) ?? []).map((s) => s.trim()).filter(Boolean)
}

export function parseRaw(raw: string): ParsedMime {
  const { head, headers } = splitEntity(raw)
  const out: Pick<ParsedMime, 'text' | 'html' | 'files'> = { text: '', html: '', files: [] }
  walk(raw, out)
  return {
    subject: decodeWords(headers.subject),
    from: decodeWords(headers.from),
    to: addrs(headers.to),
    cc: addrs(headers.cc),
    bcc: addrs(headers.bcc),
    replyTo: addrs(headers['reply-to']),
    headers: headerList(head).map((h) => ({ name: h.name, value: decodeWords(h.value) })),
    ...out,
  }
}
