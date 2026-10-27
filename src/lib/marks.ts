/**
 * Operações sobre lidas/estrelas/marcadores. Código puro, usado nos dois lados:
 * o servidor aplica e grava em data/state.json; a UI aplica na hora (otimista) e confirma com a resposta.
 * Sem imports de runtime: o servidor de produção carrega este arquivo direto (type stripping).
 */
import type { Flags, Label, MarksState } from './types.ts'

export type MarksOp =
  | { op: 'set'; ids: string[]; patch: Pick<Flags, 'read' | 'starred'> }
  | { op: 'toggleLabel'; ids: string[]; labelId: string; on: boolean }
  | { op: 'saveLabel'; label: Label }
  | { op: 'removeLabel'; id: string }
  /** Junta marcações vindas de fora (ex.: o localStorage da versão anterior) sem sobrescrever as existentes */
  | { op: 'import'; flags: Record<string, Flags>; labels: Label[] }

export const EMPTY_MARKS: MarksState = { rev: 0, flags: {}, labels: [] }

const byName = (a: Label, b: Label) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 300
const isIds = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 5000 && x.every(isStr)
const isLabel = (x: unknown): x is Label => {
  const l = x as Label
  return !!l && /^lbl_[a-z0-9]{1,32}$/.test(l.id) && isStr(l.name) && /^#[0-9a-f]{6}$/i.test(l.color)
}

/** Valida o que chega pela API antes de aplicar. */
export function isMarksOp(x: unknown): x is MarksOp {
  const o = x as Record<string, unknown>
  switch (o?.op) {
    case 'set': {
      const p = o.patch as Record<string, unknown> | undefined
      return isIds(o.ids) && !!p && Object.entries(p).every(([k, v]) => (k === 'read' || k === 'starred') && typeof v === 'boolean')
    }
    case 'toggleLabel':
      return isIds(o.ids) && isStr(o.labelId) && typeof o.on === 'boolean'
    case 'saveLabel':
      return isLabel(o.label)
    case 'removeLabel':
      return isStr(o.id)
    case 'import':
      return typeof o.flags === 'object' && !!o.flags && Array.isArray(o.labels) && o.labels.every(isLabel)
    default:
      return false
  }
}

/** Aplica a operação e devolve um estado novo (rev não muda aqui — quem grava incrementa). */
export function applyMarks(s: MarksState, op: MarksOp): MarksState {
  const flags = { ...s.flags }
  switch (op.op) {
    case 'set':
      for (const id of op.ids) flags[id] = { ...flags[id], ...op.patch }
      return { ...s, flags }

    case 'toggleLabel':
      for (const id of op.ids) {
        const cur = flags[id]?.labels ?? []
        const labels = op.on ? (cur.includes(op.labelId) ? cur : [...cur, op.labelId]) : cur.filter((l) => l !== op.labelId)
        flags[id] = { ...flags[id], labels }
      }
      return { ...s, flags }

    case 'saveLabel': {
      const label = { ...op.label, name: op.label.name.trim().slice(0, 40) }
      const exists = s.labels.some((l) => l.id === label.id)
      const labels = exists ? s.labels.map((l) => (l.id === label.id ? label : l)) : [...s.labels, label]
      return { ...s, labels: labels.sort(byName) }
    }

    case 'removeLabel':
      for (const [id, f] of Object.entries(s.flags)) {
        if (f.labels?.includes(op.id)) flags[id] = { ...f, labels: f.labels.filter((l) => l !== op.id) }
      }
      return { ...s, flags, labels: s.labels.filter((l) => l.id !== op.id) }

    case 'import': {
      for (const [id, f] of Object.entries(op.flags)) {
        const cur = flags[id] ?? {}
        flags[id] = {
          read: cur.read ?? f.read,
          starred: cur.starred ?? f.starred,
          labels: [...new Set([...(cur.labels ?? []), ...(f.labels ?? [])])],
        }
      }
      const known = new Set(s.labels.map((l) => l.id))
      return { ...s, flags, labels: [...s.labels, ...op.labels.filter((l) => !known.has(l.id))].sort(byName) }
    }
  }
}

/** Esquece marcações de mensagens que não existem mais no LocalStack. */
export function pruneMarks(s: MarksState, alive: Set<string>): MarksState | null {
  const stale = Object.keys(s.flags).filter((id) => !alive.has(id))
  if (!stale.length) return null
  const flags = { ...s.flags }
  for (const id of stale) delete flags[id]
  return { ...s, flags }
}
