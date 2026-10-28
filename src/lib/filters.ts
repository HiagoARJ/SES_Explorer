import { CalendarDays, Mail as MailIcon, Paperclip, Star, type LucideIcon } from 'lucide-react'
import type { Route } from '../hooks/useHashRoute'
import { isToday } from './format'
import { fold, parseAddress } from './mail'
import type { Flags, Mail } from './types'

export type Pill = 'unread' | 'starred' | 'attachments' | 'today'

export const PILLS: { id: Pill; label: string; icon: LucideIcon }[] = [
  { id: 'unread', label: 'Não lidas', icon: MailIcon },
  { id: 'starred', label: 'Favoritos', icon: Star },
  { id: 'attachments', label: 'Anexos', icon: Paperclip },
  { id: 'today', label: 'Hoje', icon: CalendarDays },
]

const emailOf = (s: string) => parseAddress(s).email.toLowerCase()

export function pillMatch(id: Pill, m: Mail, f: Flags): boolean {
  if (id === 'unread') return !f.read
  if (id === 'starred') return !!f.starred
  if (id === 'attachments') return m.files.length > 0
  return isToday(m.ts)
}

/** A mensagem pertence à pasta/remetente/destinatário da rota? */
export function inView(m: Mail, r: Route, f: Flags): boolean {
  switch (r.kind) {
    case 'starred':
      return !!f.starred
    case 'unread':
      return !f.read
    case 'attachments':
      return m.files.length > 0
    case 'from':
      return m.fromEmail.toLowerCase() === r.value?.toLowerCase()
    case 'to':
      return [...m.to, ...m.cc, ...m.bcc].some((a) => emailOf(a) === r.value?.toLowerCase())
    case 'label':
      return !!r.value && !!f.labels?.includes(r.value)
    default:
      return true
  }
}

export function matchesQuery(m: Mail, q: string): boolean {
  const s = fold(q.trim())
  return !s || s.split(/\s+/).every((w) => m.haystack.includes(w))
}

export function viewTitle(r: Route): string {
  switch (r.kind) {
    case 'starred':
      return 'Favoritos'
    case 'unread':
      return 'Não lidas'
    case 'attachments':
      return 'Anexos'
    case 'from':
      return 'Enviadas por'
    case 'to':
      return 'Enviadas para'
    case 'label':
      return 'Marcador'
    default:
      return 'Caixa de entrada'
  }
}

export interface Party {
  email: string
  name: string
  count: number
  unread: number
}

/** Remetentes e destinatários com contagem, para a barra lateral. */
export function parties(mails: Mail[], flags: Record<string, Flags>) {
  const senders = new Map<string, Party>()
  const recipients = new Map<string, Party>()
  const bump = (map: Map<string, Party>, raw: string, unread: boolean) => {
    const { name, email } = parseAddress(raw)
    const k = email.toLowerCase()
    const p = map.get(k) ?? { email, name, count: 0, unread: 0 }
    p.count++
    if (unread) p.unread++
    map.set(k, p)
  }
  for (const m of mails) {
    const unread = !flags[m.id]?.read
    bump(senders, m.source, unread)
    for (const a of new Set([...m.to, ...m.cc, ...m.bcc])) bump(recipients, a, unread)
  }
  const sort = (map: Map<string, Party>) => [...map.values()].sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
  return { senders: sort(senders), recipients: sort(recipients) }
}
