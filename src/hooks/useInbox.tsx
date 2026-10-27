import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { toMail } from '../lib/mail'
import type { Mail } from '../lib/types'
import { useFlags } from './useFlags'
import { useSettings } from './useSettings'

export type Status = 'connecting' | 'online' | 'offline'

interface InboxCtx {
  mails: Mail[]
  status: Status
  error: string | null
  /** Carregamento visível (não inclui a atualização automática silenciosa) */
  loading: boolean
  endpoint: string
  region: string
  updatedAt: number | null
  /** Ids que acabaram de chegar — a lista destaca por alguns segundos */
  fresh: Set<string>
  refresh: (quiet?: boolean) => Promise<void>
  remove: (ids: string[]) => Promise<void>
  clear: () => Promise<void>
  /** Avisa quando chegam mensagens novas (depois da primeira carga). */
  onNewMail: (cb: (mails: Mail[]) => void) => () => void
}

const Ctx = createContext<InboxCtx | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { sync } = useFlags()
  const [mails, setMails] = useState<Mail[]>([])
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState({ endpoint: '', region: '' })
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())

  const known = useRef<Map<string, Mail> | null>(null)
  const sig = useRef('')
  const removing = useRef(new Set<string>())
  const inflight = useRef<Promise<void> | null>(null)
  const listeners = useRef(new Set<(m: Mail[]) => void>())

  const load = useCallback(
    (quiet = false): Promise<void> => {
      if (inflight.current) return inflight.current
      if (!quiet) setLoading(true)
      const run = (async () => {
        try {
          const data = await api.list()
          const prev = known.current
          // Reaproveita os objetos já conhecidos: a mensagem aberta não re-renderiza à toa
          const next = data.messages
            .filter((m) => !removing.current.has(m.id))
            .map((m) => prev?.get(m.id) ?? toMail(m))
            .sort((a, b) => b.ts.getTime() - a.ts.getTime() || b.id.localeCompare(a.id))

          const s = next.map((m) => m.id).join('|')
          if (s !== sig.current) {
            sig.current = s
            setMails(next)
          }
          known.current = new Map(next.map((m) => [m.id, m]))

          const arrived = prev ? next.filter((m) => !prev.has(m.id)) : []
          if (arrived.length) {
            const ids = arrived.map((m) => m.id)
            setFresh((f) => new Set([...f, ...ids]))
            setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !ids.includes(id)))), 3000)
            listeners.current.forEach((cb) => cb(arrived))
          }

          sync(data.state)
          setMeta({ endpoint: data.endpoint, region: data.region })
          setStatus('online')
          setError(null)
          setUpdatedAt(Date.now())
        } catch (e) {
          setStatus('offline')
          setError((e as Error).message)
        } finally {
          setLoading(false)
          inflight.current = null
        }
      })()
      inflight.current = run
      return run
    },
    [sync],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Atualização automática; com a aba escondida e sem notificações, espera ela voltar
  useEffect(() => {
    if (!settings.refreshMs) return
    const t = setInterval(() => {
      if (document.hidden && !settings.notify) return
      void load(true)
    }, settings.refreshMs)
    const onVisible = () => !document.hidden && void load(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [settings.refreshMs, settings.notify, load])

  const remove = useCallback(
    async (ids: string[]) => {
      ids.forEach((id) => removing.current.add(id))
      setMails((m) => m.filter((x) => !ids.includes(x.id)))
      try {
        await Promise.all(ids.map((id) => api.remove(id)))
      } finally {
        ids.forEach((id) => removing.current.delete(id))
        sig.current = ''
        await load(true)
      }
    },
    [load],
  )

  const clear = useCallback(async () => {
    await api.clear()
    sig.current = ''
    await load()
  }, [load])

  const onNewMail = useCallback((cb: (m: Mail[]) => void) => {
    listeners.current.add(cb)
    return () => void listeners.current.delete(cb)
  }, [])

  const value = useMemo(
    () => ({ mails, status, error, loading, ...meta, updatedAt, fresh, refresh: load, remove, clear, onNewMail }),
    [mails, status, error, loading, meta, updatedAt, fresh, load, remove, clear, onNewMail],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInbox(): InboxCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useInbox fora do InboxProvider')
  return c
}
