import { useCallback, useEffect, useState } from 'react'

export type ViewKind = 'inbox' | 'starred' | 'unread' | 'attachments' | 'from' | 'to' | 'label'

const KINDS: ViewKind[] = ['inbox', 'starred', 'unread', 'attachments', 'from', 'to', 'label']
/** Visões que precisam de um valor (endereço ou id do marcador) */
const VALUED: ViewKind[] = ['from', 'to', 'label']

export interface Route {
  kind: ViewKind
  /** Endereço quando kind = from/to; id do marcador quando kind = label */
  value?: string
  /** Mensagem aberta */
  message?: string
}

/** #/inbox · #/starred · #/from/<email> · #/to/<email> · #/label/<id> · …/m/<id> (e o antigo #m/<id>) */
function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const legacy = raw.match(/^m\/(.+)$/)
  if (legacy) return { kind: 'inbox', message: decodeURIComponent(legacy[1]) }

  const [view, msg] = raw.split(/\/m\//)
  const parts = view.split('/').filter(Boolean)
  const kind = KINDS.find((k) => k === parts[0]) ?? 'inbox'
  const valued = VALUED.includes(kind)
  const value = valued && parts[1] ? decodeURIComponent(parts[1]) : undefined
  return {
    kind: value || !valued ? kind : 'inbox',
    value,
    message: msg ? decodeURIComponent(msg) : undefined,
  }
}

export function routeHref(r: Route): string {
  const view = r.value && VALUED.includes(r.kind) ? `${r.kind}/${encodeURIComponent(r.value)}` : r.kind
  return `#/${view}${r.message ? `/m/${encodeURIComponent(r.message)}` : ''}`
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  /** replace = troca a mensagem aberta sem empilhar no histórico (navegar com j/k). */
  const navigate = useCallback((r: Route, replace = false) => {
    const href = routeHref(r)
    if (href === window.location.hash) return
    if (replace) {
      history.replaceState(null, '', `${location.pathname}${location.search}${href}`)
      setRoute(parse(href))
    } else {
      window.location.hash = href
    }
  }, [])

  return { route, navigate }
}

export type Navigate = ReturnType<typeof useHashRoute>['navigate']
