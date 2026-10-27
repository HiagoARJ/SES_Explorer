import {
  CheckCheck,
  CornerDownLeft,
  Inbox,
  Keyboard,
  Mail,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Settings,
  Star,
  SunMoon,
  Tag,
  Tags,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFlags } from '../../hooks/useFlags'
import { useInbox } from '../../hooks/useInbox'
import { useLabels } from '../../hooks/useLabels'
import { shortDate } from '../../lib/format'
import { matchesQuery } from '../../lib/filters'
import { colorFor, fold } from '../../lib/mail'
import { useEscape } from '../ui/Dialog'
import { Kbd } from '../ui/Misc'

interface Entry {
  id: string
  group: 'Mensagens' | 'Ações'
  label: string
  hint?: string
  icon?: LucideIcon
  color?: string
  unread?: boolean
  run: () => void
}

export interface PaletteActions {
  openMail: (id: string) => void
  goto: (kind: 'inbox' | 'starred' | 'unread' | 'attachments' | 'label', value?: string) => void
  createLabel: () => void
  refresh: () => void
  compose: () => void
  markAllRead: () => void
  clearInbox: () => void
  toggleTheme: () => void
  settings: () => void
  shortcuts: () => void
}

export function CommandPalette({ open, onClose, actions }: { open: boolean; onClose: () => void; actions: PaletteActions }) {
  const { mails } = useInbox()
  const { flags } = useFlags()
  const { labels } = useLabels()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEscape(onClose, open)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const entries = useMemo<Entry[]>(() => {
    const s = fold(q.trim())
    const act = (id: string, label: string, icon: LucideIcon, run: () => void, hint?: string): Entry => ({ id, group: 'Ações', label, icon, run, hint })
    const acts = [
      act('compose', 'Escrever e-mail de teste', PenSquare, actions.compose, 'c'),
      act('refresh', 'Atualizar caixa', RefreshCw, actions.refresh, 'r'),
      act('inbox', 'Ir para Caixa de entrada', Inbox, () => actions.goto('inbox')),
      act('unread', 'Ir para Não lidas', Mail, () => actions.goto('unread')),
      act('starred', 'Ir para Com estrela', Star, () => actions.goto('starred')),
      act('att', 'Ir para Com anexos', Paperclip, () => actions.goto('attachments')),
      ...labels.map((l) => ({ ...act(`label:${l.id}`, `Ir para marcador ${l.name}`, Tag, () => actions.goto('label', l.id)), color: l.color })),
      act('newlabel', 'Novo marcador', Tags, actions.createLabel),
      act('readall', 'Marcar todas como lidas', CheckCheck, actions.markAllRead),
      act('theme', 'Alternar tema', SunMoon, actions.toggleTheme),
      act('settings', 'Preferências', Settings, actions.settings),
      act('keys', 'Atalhos de teclado', Keyboard, actions.shortcuts, '?'),
      act('clear', 'Limpar caixa no LocalStack', Trash2, actions.clearInbox),
    ].filter((a) => !s || fold(a.label).includes(s))

    const msgs = (s ? mails.filter((m) => matchesQuery(m, q)) : mails).slice(0, 30).map<Entry>((m) => ({
      id: `m:${m.id}`,
      group: 'Mensagens',
      label: m.subject,
      hint: `${m.fromName} · ${shortDate(m.ts)}`,
      color: colorFor(m.fromEmail),
      unread: !flags[m.id]?.read,
      run: () => actions.openMail(m.id),
    }))
    // Sem busca, ações primeiro; com busca, mensagens primeiro
    return s ? [...msgs, ...acts] : [...acts.slice(0, 4), ...msgs.slice(0, 8), ...acts.slice(4)]
  }, [q, mails, flags, actions, labels])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const choose = (e?: Entry) => {
    if (!e) return
    onClose()
    e.run()
  }

  let lastGroup = ''
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="animate-fade-in fixed inset-0 bg-zinc-950/40 backdrop-blur-[2px] dark:bg-black/60" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search className="size-4 text-zinc-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, entries.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(entries[active])
              }
            }}
            placeholder="Buscar mensagem ou ação…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">Nada encontrado.</p>
          ) : (
            entries.map((e, i) => {
              const header = e.group !== lastGroup ? e.group : null
              lastGroup = e.group
              return (
                <div key={e.id}>
                  {header && <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">{header}</p>}
                  <button
                    data-idx={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(e)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      i === active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100' : ''
                    }`}
                  >
                    {e.icon ? (
                      <e.icon className={`size-4 shrink-0 ${e.color ? '' : 'opacity-60'}`} style={e.color ? { color: e.color } : undefined} />
                    ) : (
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    )}
                    <span className={`min-w-0 flex-1 truncate ${e.unread ? 'font-semibold' : ''}`}>{e.label}</span>
                    {e.hint && <span className="max-w-[45%] shrink-0 truncate text-xs text-zinc-400">{e.hint}</span>}
                    {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-zinc-400" />}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
