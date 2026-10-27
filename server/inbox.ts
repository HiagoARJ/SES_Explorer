/**
 * API da caixa de entrada — usada pelo Vite (dev) e pelo server/index.ts (produção).
 *
 *   GET    /api/ses                            lista normalizada (sem bytes de anexo)
 *   DELETE /api/ses                            limpa a caixa no LocalStack
 *   DELETE /api/ses/:id                        exclui uma mensagem
 *   POST   /api/ses/send                       envia um e-mail de teste (SendEmail)
 *   GET    /api/ses/identities                 identidades verificadas (sugestões do remetente)
 *   GET    /api/ses/:id/attachments/:index     serve um anexo (?download=1 força o download)
 *   GET    /api/ses/:id/source                 MIME original (?download=1 baixa como .eml)
 *   GET    /api/state                          lidas, estrelas e marcadores (data/state.json)
 *   POST   /api/state                          aplica uma operação (ver src/lib/marks.ts)
 */
import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Attachment, InboxResponse, MailMessage, SendRequest } from '../src/lib/types.ts'
import { isMarksOp } from '../src/lib/marks.ts'
import { parseRaw, type MimeFile } from './mime.ts'
import { createStore } from './store.ts'

/** Formato de /_aws/ses no LocalStack */
interface LsMessage {
  Id: string
  Region?: string
  Source?: string
  Destination?: { ToAddresses?: string[]; CcAddresses?: string[]; BccAddresses?: string[] }
  Subject?: string
  Body?: { text_part?: string | null; html_part?: string | null }
  Timestamp?: string
  RawData?: string
  Template?: string
  TemplateData?: string
}

interface Entry {
  meta: MailMessage
  files: MimeFile[]
  /** MIME original (SendRawEmail) ou o JSON do LocalStack */
  source: string
}

type Next = (err?: unknown) => void

class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// O navegador abre PDF, imagem e texto na própria aba; o resto (e ?download=1) vai como arquivo.
const VIEWABLE = /^(application\/pdf|image\/|text\/(plain|csv))/

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n')
const word = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`)
const emailOf = (s: string) => s.match(/<([^>]+)>/)?.[1].trim() ?? s.trim()
const fileName = (subject: string) => `${subject.replace(/[^\p{L}\p{N} _-]+/gu, '_').trim().slice(0, 80) || 'mensagem'}.eml`

/** Monta um .eml para mensagens que não vieram como MIME (SendEmail / SendTemplatedEmail). */
function buildEml(m: MailMessage): string {
  const bd = `sesx-${m.id.slice(0, 16)}`
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(m.timestamp) ? m.timestamp : `${m.timestamp}Z`)
  return [
    `From: ${m.source}`,
    `To: ${m.to.join(', ')}`,
    ...(m.cc.length ? [`Cc: ${m.cc.join(', ')}`] : []),
    `Subject: ${word(m.subject)}`,
    `Date: ${isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString()}`,
    `Message-ID: <${m.id}@localstack>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${bd}"`,
    '',
    `--${bd}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.text || m.template?.data || ''),
    `--${bd}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.html || ''),
    `--${bd}--`,
    '',
  ].join('\r\n')
}

function normalize(msg: LsMessage): Entry {
  const d = msg.Destination ?? {}
  let meta: MailMessage = {
    id: msg.Id,
    region: msg.Region ?? '',
    source: msg.Source ?? '',
    to: d.ToAddresses ?? [],
    cc: d.CcAddresses ?? [],
    bcc: d.BccAddresses ?? [],
    replyTo: [],
    subject: msg.Subject || (msg.Template ? `Template ${msg.Template}` : '(sem assunto)'),
    text: msg.Body?.text_part ?? '',
    html: msg.Body?.html_part ?? '',
    timestamp: msg.Timestamp ?? '',
    raw: false,
    size: 0,
    attachments: [],
    headers: [],
    ...(msg.Template ? { template: { name: msg.Template, data: msg.TemplateData ?? '' } } : {}),
  }
  let files: MimeFile[] = []
  const source = msg.RawData || JSON.stringify(msg, null, 2)

  if (msg.RawData) {
    const p = parseRaw(msg.RawData)
    files = p.files
    meta = {
      ...meta,
      raw: true,
      subject: p.subject || '(sem assunto)',
      text: p.text,
      html: p.html,
      // o Source do LocalStack vem sem nome de exibição; o From do MIME costuma ter ("Loja <no-reply@…>")
      source: p.from && (!meta.source || p.from.toLowerCase().includes(meta.source.toLowerCase())) ? p.from : meta.source,
      to: meta.to.length ? meta.to : p.to,
      cc: meta.cc.length ? meta.cc : p.cc,
      bcc: meta.bcc.length ? meta.bcc : p.bcc,
      replyTo: p.replyTo,
      headers: p.headers,
      attachments: files.map<Attachment>((a, index) => ({ index, name: a.name, type: a.type, size: a.size, inline: a.inline, cid: a.cid })),
    }
    // imagens embutidas (cid:) apontam para a rota de anexos
    meta.html = meta.html.replace(/(["'(])cid:([^"')\s]+)/gi, (all, q: string, cid: string) => {
      const i = files.findIndex((a) => a.cid === cid)
      return i < 0 ? all : `${q}/api/ses/${encodeURIComponent(meta.id)}/attachments/${i}`
    })
  }
  meta.size = Buffer.byteLength(source)
  return { meta, files, source }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage, limit = 5 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, 'too_large', 'corpo da requisição muito grande')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function createInboxApi({ localstackUrl, region, dataDir }: { localstackUrl: string; region: string; dataDir: string }) {
  const base = localstackUrl.replace(/\/+$/, '')
  const cache = new Map<string, Entry>()
  const store = createStore(dataDir)

  async function call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
    } catch (err) {
      const e = err as { cause?: { code?: string }; name?: string; message?: string }
      const why = e.cause?.code ?? (e.name === 'TimeoutError' ? 'tempo esgotado' : e.message)
      throw new HttpError(502, 'localstack_unreachable', `sem resposta de ${base} (${why})`)
    }
  }

  /** API Query do SES. O LocalStack não confere a assinatura, só lê região e serviço do Authorization. */
  async function ses(action: string, params: Record<string, string>): Promise<string> {
    const r = await call(`${base}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
        authorization: `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/ses/aws4_request, SignedHeaders=host, Signature=0`,
      },
      body: new URLSearchParams({ Action: action, Version: '2010-12-01', ...params }),
    })
    const text = await r.text()
    if (!r.ok) {
      const msg = text.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? text.slice(0, 300)
      throw new HttpError(r.status === 400 ? 400 : 502, 'ses_error', `${action}: ${msg}`)
    }
    return text
  }

  async function list(res: ServerResponse) {
    const r = await call(`${base}/_aws/ses`, { headers: { accept: 'application/json' } })
    const body = await r.text()
    if (!r.ok) throw new HttpError(r.status, 'localstack_error', body.slice(0, 400))
    let data: { messages?: LsMessage[] }
    try {
      data = JSON.parse(body)
    } catch {
      throw new HttpError(502, 'bad_json', 'resposta inválida do LocalStack')
    }

    const messages: MailMessage[] = []
    const seen = new Set<string>()
    for (const msg of data.messages ?? []) {
      seen.add(msg.Id)
      let entry = cache.get(msg.Id)
      if (!entry) {
        try {
          entry = normalize(msg)
        } catch (e) {
          entry = normalize({ ...msg, RawData: undefined, Subject: '(falha ao ler o MIME)', Body: { text_part: String((e as Error).message) } })
        }
        cache.set(msg.Id, entry)
      }
      messages.push(entry.meta)
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id)
    store.prune(seen)

    json(res, 200, { endpoint: base, region, messages, state: store.get() } satisfies InboxResponse)
  }

  async function remove(res: ServerResponse, id?: string) {
    const r = await call(`${base}/_aws/ses${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method: 'DELETE' })
    if (!r.ok) throw new HttpError(r.status, 'localstack_error', (await r.text()).slice(0, 400))
    if (id) cache.delete(id)
    else cache.clear()
    json(res, 200, { ok: true })
  }

  async function send(req: IncomingMessage, res: ServerResponse) {
    let b: Partial<SendRequest>
    try {
      b = JSON.parse(await readBody(req))
    } catch (e) {
      if (e instanceof HttpError) throw e
      throw new HttpError(400, 'bad_request', 'JSON inválido')
    }
    const to = (b.to ?? []).filter(Boolean)
    if (!b.from || !to.length) throw new HttpError(400, 'bad_request', 'informe remetente e ao menos um destinatário')
    if (!b.text && !b.html) throw new HttpError(400, 'bad_request', 'informe o corpo em texto ou HTML')

    // O SES só aceita remetentes verificados; no LocalStack verificar é instantâneo.
    await ses('VerifyEmailIdentity', { EmailAddress: emailOf(b.from) })
    const members = (prefix: string, list: string[] = []) =>
      Object.fromEntries(list.filter(Boolean).map((v, i) => [`${prefix}.member.${i + 1}`, v]))
    const xml = await ses('SendEmail', {
      Source: b.from,
      ...members('Destination.ToAddresses', to),
      ...members('Destination.CcAddresses', b.cc),
      'Message.Subject.Data': b.subject || '(sem assunto)',
      'Message.Subject.Charset': 'UTF-8',
      ...(b.text ? { 'Message.Body.Text.Data': b.text, 'Message.Body.Text.Charset': 'UTF-8' } : {}),
      ...(b.html ? { 'Message.Body.Html.Data': b.html, 'Message.Body.Html.Charset': 'UTF-8' } : {}),
    })
    json(res, 200, { messageId: xml.match(/<MessageId>([^<]+)<\/MessageId>/)?.[1] ?? '' })
  }

  async function identities(res: ServerResponse) {
    const xml = await ses('ListIdentities', { IdentityType: 'EmailAddress', MaxItems: '1000' })
    const list = [...xml.matchAll(/<member>([^<]+)<\/member>/g)].map((m) => m[1]).sort()
    json(res, 200, { identities: list })
  }

  function attachment(res: ServerResponse, id: string, index: number, download: boolean) {
    const file = cache.get(id)?.files[index]
    if (!file) throw new HttpError(404, 'not_found', 'anexo não encontrado — atualize a lista')
    const inline = !download && VIEWABLE.test(file.type)
    res.writeHead(200, {
      'content-type': /^text\//.test(file.type) && !/charset/.test(file.type) ? `${file.type}; charset=utf-8` : file.type || 'application/octet-stream',
      'content-length': file.data.length,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    })
    res.end(file.data)
  }

  function source(res: ServerResponse, id: string, download: boolean) {
    const entry = cache.get(id)
    if (!entry) throw new HttpError(404, 'not_found', 'mensagem não encontrada — atualize a lista')
    const eml = entry.meta.raw ? entry.source : buildEml(entry.meta)
    if (download) {
      res.writeHead(200, {
        'content-type': 'message/rfc822',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName(entry.meta.subject))}`,
      })
      return res.end(eml)
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    res.end(entry.meta.raw ? entry.source : `${eml}\r\n\r\n--- JSON original do LocalStack ---\r\n\r\n${entry.source}`)
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, next: Next) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    if (!path.startsWith('/api/')) return next()
    const method = req.method ?? 'GET'
    const download = url.searchParams.get('download') === '1'

    try {
      if (path === '/api/ses') {
        if (method === 'GET') return await list(res)
        if (method === 'DELETE') return await remove(res)
      }
      if (path === '/api/state') {
        if (method === 'GET') return json(res, 200, store.get())
        if (method === 'POST') {
          let op: unknown
          try {
            op = JSON.parse(await readBody(req))
          } catch (e) {
            if (e instanceof HttpError) throw e
            throw new HttpError(400, 'bad_request', 'JSON inválido')
          }
          if (!isMarksOp(op)) throw new HttpError(400, 'bad_request', 'operação inválida')
          return json(res, 200, store.apply(op))
        }
      }
      if (path === '/api/ses/send' && method === 'POST') return await send(req, res)
      if (path === '/api/ses/identities' && method === 'GET') return await identities(res)

      let m = path.match(/^\/api\/ses\/([^/]+)\/attachments\/(\d+)$/)
      if (m && method === 'GET') return attachment(res, decodeURIComponent(m[1]), Number(m[2]), download)

      m = path.match(/^\/api\/ses\/([^/]+)\/source$/)
      if (m && method === 'GET') return source(res, decodeURIComponent(m[1]), download)

      m = path.match(/^\/api\/ses\/([^/]+)$/)
      if (m && method === 'DELETE') return await remove(res, decodeURIComponent(m[1]))

      throw new HttpError(404, 'not_found', `rota inexistente: ${method} ${path}`)
    } catch (err) {
      const e = err instanceof HttpError ? err : new HttpError(500, 'internal', (err as Error)?.message ?? String(err))
      if (res.headersSent) return res.end()
      json(res, e.status, { error: e.code, message: e.message })
    }
  }
}
