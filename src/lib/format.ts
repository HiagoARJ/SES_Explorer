const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']

/** O LocalStack grava o Timestamp em UTC e sem sufixo de fuso. */
export function parseTimestamp(t: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`)
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export const isToday = (d: Date) => midnight(d) === midnight(new Date())

/** Hora para hoje, "12 de out." no ano e data completa nos anteriores — como no Gmail. */
export function shortDate(d: Date): string {
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (isToday(d)) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} de ${MONTHS[d.getMonth()]}`
  return d.toLocaleDateString('pt-BR')
}

export function fullDate(d: Date): string {
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(d: Date, now = Date.now()): string {
  const diff = (d.getTime() - now) / 1000
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 10) return 'agora'
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function dayLabel(d: Date): string {
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days > 1 && days < 7) return cap(d.toLocaleDateString('pt-BR', { weekday: 'long' }))
  return cap(
    d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    }),
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

/** Baixa pelo navegador (a URL precisa ser da mesma origem para o atributo download valer). */
export function triggerDownload(url: string, filename = ''): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
