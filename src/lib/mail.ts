import { FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, File as FileIcon, type LucideIcon } from 'lucide-react'
import { parseTimestamp } from './format'
import type { Attachment, Mail, MailMessage } from './types'

/** "Loja <no-reply@x.com>" → { name: "Loja", email: "no-reply@x.com" } */
export function parseAddress(s: string): { name: string; email: string } {
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim() }
  const email = s.trim()
  return { name: email.split('@')[0] || email || '(desconhecido)', email }
}

const PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#2563eb', '#0d9488', '#ea580c']

export function colorFor(s: string): string {
  let h = 0
  for (const c of s.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]+/gu, ' ').trim().split(/\s+/)
  const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 1)
  return (s || '?').toUpperCase()
}

/* ---------------- busca sem acentos ---------------- */

/** Dobra cada unidade UTF-16 para uma só (sem acento, minúscula): os índices continuam batendo com o original. */
export function fold(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) out += s[i].normalize('NFD')[0].toLowerCase()[0] ?? s[i]
  return out
}

export function matchRanges(text: string, query: string): [number, number][] {
  const q = fold(query.trim())
  if (!q) return []
  const t = fold(text)
  const out: [number, number][] = []
  let i = t.indexOf(q)
  while (i >= 0 && out.length < 50) {
    out.push([i, i + q.length])
    i = t.indexOf(q, i + q.length)
  }
  return out
}

/* ---------------- corpo ---------------- */

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" }

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (_m, e: string) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

export function toMail(m: MailMessage): Mail {
  const from = parseAddress(m.source)
  const body = m.text || htmlToText(m.html) || m.template?.data || ''
  const files = m.attachments.filter((a) => !(a.inline && a.cid && a.type.startsWith('image/')))
  return {
    ...m,
    ts: parseTimestamp(m.timestamp),
    fromName: from.name,
    fromEmail: from.email,
    snippet: squash(body).slice(0, 240),
    files,
    haystack: fold([m.subject, m.source, ...m.to, ...m.cc, ...m.bcc, squash(body), m.region, m.id, ...files.map((a) => a.name)].join(' \u0001 ')),
  }
}

/* ---------------- anexos ---------------- */

export type FileKind = 'pdf' | 'image' | 'archive' | 'doc' | 'sheet' | 'code' | 'text' | 'other'

export function fileKind(a: Pick<Attachment, 'name' | 'type'>): FileKind {
  const t = a.type.toLowerCase()
  const n = a.name.toLowerCase()
  if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (t.startsWith('image/')) return 'image'
  if (/zip|compress|tar|rar|7z|gzip/.test(t) || /\.(zip|rar|7z|tar|gz)$/.test(n)) return 'archive'
  if (/sheet|excel|csv/.test(t) || /\.(xlsx?|csv|ods)$/.test(n)) return 'sheet'
  if (/word|opendocument\.text|rtf/.test(t) || /\.(docx?|odt|rtf)$/.test(n)) return 'doc'
  if (/json|xml|javascript|html/.test(t) || /\.(json|xml|js|ts|html?|ya?ml)$/.test(n)) return 'code'
  if (t.startsWith('text/')) return 'text'
  return 'other'
}

export const FILE_STYLE: Record<FileKind, { label: string; icon: LucideIcon; cls: string }> = {
  pdf: { label: 'PDF', icon: FileText, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  image: { label: 'IMG', icon: FileImage, cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  archive: { label: 'ZIP', icon: FileArchive, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  sheet: { label: 'PLAN', icon: FileSpreadsheet, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  doc: { label: 'DOC', icon: FileText, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  code: { label: 'CÓD', icon: FileCode, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  text: { label: 'TXT', icon: FileText, cls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
  other: { label: 'ARQ', icon: FileIcon, cls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400' },
}

/** Tipos que o navegador mostra sozinho (PDF, imagem) ou que dá para ler como texto. */
export function previewMode(a: Attachment): 'frame' | 'image' | 'text' | null {
  const k = fileKind(a)
  if (k === 'pdf') return 'frame'
  if (k === 'image') return 'image'
  if (k === 'text' || k === 'code' || (k === 'sheet' && /csv/.test(a.type + a.name))) return 'text'
  return null
}

/* ---------------- links ---------------- */

export interface MailLink {
  href: string
  text: string
}

/** Links do e-mail (HTML e texto), sem repetir. Útil para testar fluxos de confirmação e reset de senha. */
export function extractLinks(m: Pick<MailMessage, 'html' | 'text'>): MailLink[] {
  const out = new Map<string, MailLink>()
  if (m.html) {
    const doc = new DOMParser().parseFromString(m.html, 'text/html')
    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href')?.trim() ?? ''
      if (!/^(https?:|mailto:|tel:)/i.test(href) || out.has(href)) continue
      out.set(href, { href, text: squash(a.textContent ?? '') })
    }
  }
  for (const [href] of m.text.matchAll(/https?:\/\/[^\s<>"')]+/g)) {
    const clean = href.replace(/[.,;:!?]+$/, '')
    if (!out.has(clean)) out.set(clean, { href: clean, text: '' })
  }
  return [...out.values()]
}

/* ---------------- HTML do e-mail ---------------- */

export const frameDoc = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
  `<style>html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#202124;padding:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>` +
  `</head><body>${html}</body></html>`

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Abre o e-mail sozinho numa aba (e imprime, se pedido). */
export function openStandalone(m: Pick<MailMessage, 'subject' | 'html' | 'text'>, print = false): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(`<title>${escapeHtml(m.subject)}</title>` + frameDoc(m.html || `<pre style="white-space:pre-wrap">${escapeHtml(m.text)}</pre>`))
  w.document.close()
  if (print) setTimeout(() => (w.focus(), w.print()), 400)
  return true
}

/** O que a aba JSON mostra: a mensagem como a API devolve, sem os campos calculados na UI. */
export function plainMessage(m: Mail): MailMessage {
  const { ts: _ts, fromName: _n, fromEmail: _e, snippet: _s, haystack: _h, files: _f, ...rest } = m
  return rest
}
