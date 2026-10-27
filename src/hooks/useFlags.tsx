import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { applyMarks, EMPTY_MARKS, type MarksOp } from '../lib/marks'
import { clearLocalMarks, takeLocalMarks } from '../lib/storage'
import type { Flags, Label, MarksState } from '../lib/types'
import { useToast } from './useToast'

/**
 * Lida/não lida, estrela e marcadores. O SES não guarda isso, então fica no servidor do SES Explorer
 * (data/state.json) — o mesmo para Docker e npm run dev, e para qualquer navegador.
 * Cada ação aplica na hora (otimista) e confirma com a resposta do servidor.
 */
interface FlagsCtx {
  flags: Record<string, Flags>
  labels: Label[]
  get: (id: string) => Flags
  set: (ids: string | string[], patch: Pick<Flags, 'read' | 'starred'>) => void
  /** Aplica (on) ou tira um marcador de várias mensagens. */
  toggleLabel: (ids: string[], labelId: string, on: boolean) => void
  saveLabel: (label: Label) => void
  /** Exclui o marcador e tira ele de todas as mensagens. */
  removeLabel: (id: string) => void
  /** Estado que veio junto com a lista de mensagens (mantém abas e modos sincronizados). */
  sync: (s: MarksState) => void
}

const Ctx = createContext<FlagsCtx | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [state, setState] = useState<MarksState>(EMPTY_MARKS)
  const rev = useRef(-1)
  const pending = useRef(0)

  /** Só aceita estado mais novo, e nunca no meio de uma gravação (evita "piscar" de volta). */
  const sync = useCallback((s: MarksState) => {
    if (pending.current > 0 || s.rev < rev.current) return
    rev.current = s.rev
    setState(s)
  }, [])

  const send = useCallback(
    (op: MarksOp) => {
      setState((s) => applyMarks(s, op))
      pending.current++
      api
        .applyMarks(op)
        .then((s) => {
          pending.current--
          sync(s)
        })
        .catch((e: Error) => {
          pending.current--
          toast('error', 'Não deu para salvar a marcação', e.message)
          rev.current = -1
          api.marks().then(sync, () => {})
        })
    },
    [sync, toast],
  )

  // Carga inicial + migração do que versões anteriores guardavam no navegador
  useEffect(() => {
    let alive = true
    api
      .marks()
      .then((s) => {
        if (!alive) return
        sync(s)
        const local = takeLocalMarks()
        if (local) {
          send({ op: 'import', ...local })
          clearLocalMarks()
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sync, send])

  const set = useCallback(
    (ids: string | string[], patch: Pick<Flags, 'read' | 'starred'>) => send({ op: 'set', ids: Array.isArray(ids) ? ids : [ids], patch }),
    [send],
  )
  const toggleLabel = useCallback((ids: string[], labelId: string, on: boolean) => send({ op: 'toggleLabel', ids, labelId, on }), [send])
  const saveLabel = useCallback((label: Label) => send({ op: 'saveLabel', label }), [send])
  const removeLabel = useCallback((id: string) => send({ op: 'removeLabel', id }), [send])
  const get = useCallback((id: string) => state.flags[id] ?? {}, [state.flags])

  const value = useMemo(
    () => ({ flags: state.flags, labels: state.labels, get, set, toggleLabel, saveLabel, removeLabel, sync }),
    [state, get, set, toggleLabel, saveLabel, removeLabel, sync],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFlags(): FlagsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFlags fora do FlagsProvider')
  return c
}
