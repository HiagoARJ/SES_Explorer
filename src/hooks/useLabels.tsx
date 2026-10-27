import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { fold } from '../lib/mail'
import type { Label } from '../lib/types'
import { useFlags } from './useFlags'

export const LABEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b']

interface LabelsCtx {
  labels: Label[]
  byId: Map<string, Label>
  /** Cria (ou devolve o que já existe com o mesmo nome). O id sai na hora, antes do servidor confirmar. */
  create: (name: string, color?: string) => Label
  update: (id: string, patch: Partial<Omit<Label, 'id'>>) => void
  /** Exclui o marcador e tira ele de todas as mensagens. */
  remove: (id: string) => void
  /** Próxima cor sugerida: a menos usada da paleta. */
  nextColor: () => string
  findByName: (name: string) => Label | undefined
}

const Ctx = createContext<LabelsCtx | null>(null)

const newId = () => `lbl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Os marcadores vivem no mesmo estado do servidor que lidas/estrelas (useFlags); aqui só a API de conveniência. */
export function LabelsProvider({ children }: { children: ReactNode }) {
  const { labels, saveLabel, removeLabel } = useFlags()

  const findByName = useCallback((name: string) => labels.find((l) => fold(l.name) === fold(name.trim())), [labels])

  const nextColor = useCallback(() => {
    const use = new Map(LABEL_COLORS.map((c) => [c, 0]))
    for (const l of labels) use.set(l.color, (use.get(l.color) ?? 0) + 1)
    return [...use.entries()].sort((a, b) => a[1] - b[1])[0][0]
  }, [labels])

  const create = useCallback(
    (name: string, color?: string) => {
      const existing = findByName(name)
      if (existing) return existing
      const label = { id: newId(), name: name.trim().slice(0, 40), color: color ?? nextColor() }
      saveLabel(label)
      return label
    },
    [findByName, nextColor, saveLabel],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Label, 'id'>>) => {
      const cur = labels.find((l) => l.id === id)
      if (cur) saveLabel({ ...cur, ...patch })
    },
    [labels, saveLabel],
  )

  const byId = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const value = useMemo(
    () => ({ labels, byId, create, update, remove: removeLabel, nextColor, findByName }),
    [labels, byId, create, update, removeLabel, nextColor, findByName],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLabels(): LabelsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLabels fora do LabelsProvider')
  return c
}
