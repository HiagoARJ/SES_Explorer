import {
  AtSign,
  ChevronRight,
  Inbox,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  PenSquare,
  Pencil,
  Plus,
  Settings,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFlags } from '../../hooks/useFlags'
import { routeHref, type Route, type ViewKind } from '../../hooks/useHashRoute'
import { useInbox } from '../../hooks/useInbox'
import { useLabels } from '../../hooks/useLabels'
import type { Label } from '../../lib/types'
import { useNow } from '../../hooks/useMediaQuery'
import { relativeTime } from '../../lib/format'
import { parties, type Party } from '../../lib/filters'
import { colorFor } from '../../lib/mail'
import { readJSON, writeJSON } from '../../lib/storage'
import { IconButton } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'

/** Contador que "pula" quando o número muda. */
function Count({ n, strong }: { n: number; strong?: boolean }) {
  if (!n) return null
  return (
    <span
      key={n}
      className={`animate-bump ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 tabular-nums ${
        strong ? 'bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-600/30' : 'text-zinc-500 dark:text-zinc-400'
      }`}
    >
      {n}
    </span>
  )
}

function Section({
  id,
  title,
  icon: Icon,
  items,
  kind,
  route,
  onNavigate,
}: {
  id: string
  title: string
  icon: LucideIcon
  items: Party[]
  kind: 'from' | 'to'
  route: Route
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(() => readJSON(`section:${id}`, true))
  if (!items.length) return null
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          writeJSON(`section:${id}`, !open)
        }}
        className="flex w-full items-center gap-1.5 px-4 pb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-expanded={open}
      >
        <ChevronRight className={`size-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <Icon className="size-3" />
        {title}
        <span className="font-normal">{items.length}</span>
      </button>
      <div className={`collapsible ${open ? '' : 'is-closed'}`}>
        <div>
          <div className="space-y-px px-2.5 pt-0.5 pb-1">
            {items.map((p) => {
              const active = route.kind === kind && route.value?.toLowerCase() === p.email.toLowerCase()
              return (
                <a
                  key={p.email}
                  href={routeHref({ kind, value: p.email })}
                  onClick={onNavigate}
                  title={`${p.name} <${p.email}>`}
                  className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-[13px] transition-colors ${
                    active
                      ? 'bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/80 dark:text-white dark:ring-zinc-700/60'
                      : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-2 ring-white transition-transform group-hover:scale-125 dark:ring-zinc-900"
                    style={{ background: colorFor(p.email) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.email}</span>
                  <span className={`text-[11px] tabular-nums ${p.unread ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-400'}`}>
                    {p.unread ? `${p.unread}/${p.count}` : p.count}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function LabelsSection({
  route,
  counts,
  onNavigate,
  onCreate,
  onEdit,
}: {
  route: Route
  counts: Map<string, { total: number; unread: number }>
  onNavigate?: () => void
  onCreate: () => void
  onEdit: (l: Label) => void
}) {
  const { labels } = useLabels()
  const [open, setOpen] = useState(() => readJSON('section:labels', true))
  return (
    <div className="mt-4">
      <div className="flex items-center pr-2.5">
        <button
          type="button"
          onClick={() => {
            setOpen(!open)
            writeJSON('section:labels', !open)
          }}
          className="flex flex-1 items-center gap-1.5 px-4 pb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          aria-expanded={open}
        >
          <ChevronRight className={`size-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
          <Tag className="size-3" />
          Marcadores
          {labels.length > 0 && <span className="font-normal">{labels.length}</span>}
        </button>
        <IconButton icon={Plus} label="Novo marcador" size="xs" onClick={onCreate} className="-mt-1" />
      </div>
      <div className={`collapsible ${open ? '' : 'is-closed'}`}>
        <div>
          <div className="space-y-px px-2.5 pt-0.5 pb-1">
            {labels.length === 0 && (
              <button
                type="button"
                onClick={onCreate}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-2.5 py-2 text-left text-xs text-zinc-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
              >
                <Plus className="size-3.5" /> Criar marcador para organizar os e-mails
              </button>
            )}
            {labels.map((l) => {
              const active = route.kind === 'label' && route.value === l.id
              const c = counts.get(l.id)
              return (
                <a
                  key={l.id}
                  href={routeHref({ kind: 'label', value: l.id })}
                  onClick={onNavigate}
                  title={l.name}
                  className={`group animate-row-in flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-[13px] transition-colors ${
                    active
                      ? 'bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/80 dark:text-white dark:ring-zinc-700/60'
                      : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <Tag className="size-3.5 shrink-0 transition-transform group-hover:-rotate-12" style={{ color: l.color, fill: `color-mix(in oklab, ${l.color} 25%, transparent)` }} />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  <span className="relative flex h-5 min-w-5 items-center justify-end">
                    <span className={`text-[11px] tabular-nums transition-opacity group-hover:opacity-0 ${c?.unread ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-400'}`}>
                      {c ? (c.unread ? `${c.unread}/${c.total}` : c.total) : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onEdit(l)
                      }}
                      className="absolute right-0 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      aria-label={`Editar ${l.name}`}
                      title="Editar"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({
  route,
  onCompose,
  onOpenSettings,
  onCreateLabel,
  onEditLabel,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  route: Route
  onCompose: () => void
  onOpenSettings: () => void
  onCreateLabel: () => void
  onEditLabel: (l: Label) => void
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { mails, status, endpoint, region, updatedAt } = useInbox()
  const { flags } = useFlags()
  const { labels } = useLabels()
  useNow(10_000)

  const labelCounts = useMemo(() => {
    const c = new Map<string, { total: number; unread: number }>()
    for (const m of mails) {
      for (const id of flags[m.id]?.labels ?? []) {
        const x = c.get(id) ?? { total: 0, unread: 0 }
        x.total++
        if (!flags[m.id]?.read) x.unread++
        c.set(id, x)
      }
    }
    return c
  }, [mails, flags])

  const counts = useMemo(() => {
    let unread = 0
    let starred = 0
    let attachments = 0
    for (const m of mails) {
      if (!flags[m.id]?.read) unread++
      if (flags[m.id]?.starred) starred++
      if (m.files.length) attachments++
    }
    return { unread, starred, attachments }
  }, [mails, flags])
  const { senders, recipients } = useMemo(() => parties(mails, flags), [mails, flags])

  const nav: { kind: ViewKind; label: string; icon: LucideIcon; count: number; strong?: boolean }[] = [
    { kind: 'inbox', label: 'Caixa de entrada', icon: Inbox, count: counts.unread, strong: true },
    { kind: 'unread', label: 'Não lidas', icon: Mail, count: counts.unread },
    { kind: 'starred', label: 'Com estrela', icon: Star, count: counts.starred },
    { kind: 'attachments', label: 'Com anexos', icon: Paperclip, count: counts.attachments },
  ]

  const linkCls = (active: boolean) =>
    `group relative flex items-center rounded-lg text-[13px] transition-all duration-150 ${collapsed ? 'size-10 justify-center' : 'gap-2.5 px-2.5 py-1.5'} ${
      active
        ? 'bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/80 dark:text-white dark:ring-zinc-700/60'
        : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
    }`

  const statusDot = status === 'online' ? 'bg-emerald-500' : status === 'offline' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'
  const statusLabel = status === 'online' ? 'Conectado' : status === 'offline' ? 'Sem conexão' : 'Conectando…'
  const host = endpoint.replace(/^https?:\/\//, '') || 'LocalStack'
  const logo = 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-400 to-indigo-600 text-white shadow-md shadow-indigo-500/30'

  const dot = (
    <span className="relative flex size-2.5 shrink-0">
      {status === 'online' && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 [animation-duration:2.4s]" />}
      <span className={`relative size-2.5 rounded-full ${statusDot}`} />
    </span>
  )

  /* ---------------- recolhido: só ícones ---------------- */
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center">
        <Tooltip label="Expandir menu">
          <button onClick={onToggleCollapse} aria-label="Expandir menu" className={`group/logo relative mt-4 mb-3 ${logo}`}>
            <Mail className="size-4 transition-opacity group-hover/logo:opacity-0" />
            <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity group-hover/logo:opacity-100" />
          </button>
        </Tooltip>
        <Tooltip label="Escrever (c)">
          <button
            onClick={onCompose}
            aria-label="Escrever"
            className="mb-3 flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-transform hover:scale-105 hover:bg-indigo-500 active:scale-95"
          >
            <PenSquare className="size-4" />
          </button>
        </Tooltip>
        <nav className="flex flex-col items-center gap-1">
          {nav.map((n) => (
            <Tooltip key={n.kind} label={`${n.label}${n.count ? ` · ${n.count}` : ''}`}>
              <a href={routeHref({ kind: n.kind })} onClick={onNavigate} className={linkCls(route.kind === n.kind)} aria-label={n.label}>
                <n.icon className="size-4 opacity-70" />
                {n.strong && n.count > 0 && (
                  <span key={n.count} className="animate-bump absolute top-1 right-1 size-2 rounded-full bg-indigo-500 ring-2 ring-zinc-100 dark:ring-zinc-900" />
                )}
              </a>
            </Tooltip>
          ))}
        </nav>
        {/* marcadores como ícones coloridos */}
        <div className="my-3 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto">
          {labels.map((l) => (
            <Tooltip key={l.id} label={`${l.name}${labelCounts.get(l.id) ? ` · ${labelCounts.get(l.id)?.total}` : ''}`}>
              <a
                href={routeHref({ kind: 'label', value: l.id })}
                onClick={onNavigate}
                className={`${linkCls(route.kind === 'label' && route.value === l.id)} shrink-0`}
                aria-label={l.name}
              >
                <Tag className="size-4" style={{ color: l.color }} />
              </a>
            </Tooltip>
          ))}
          <Tooltip label="Novo marcador">
            <IconButton icon={Plus} label="Novo marcador" onClick={onCreateLabel} title="" />
          </Tooltip>
        </div>
        <div className="flex-1" />
        <div className="flex w-full flex-col items-center gap-1 border-t border-zinc-200 py-2.5 dark:border-zinc-800">
          <Tooltip label={`${statusLabel} · ${host}`}>
            <span className="flex size-8 items-center justify-center" aria-label={statusLabel}>
              {dot}
            </span>
          </Tooltip>
          <Tooltip label="Preferências">
            <IconButton icon={Settings} label="Preferências" onClick={onOpenSettings} title="" />
          </Tooltip>
          <Tooltip label="Expandir menu (Ctrl B)">
            <IconButton icon={PanelLeftOpen} label="Expandir menu" onClick={onToggleCollapse} title="" />
          </Tooltip>
        </div>
      </div>
    )
  }

  /* ---------------- expandido ---------------- */
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className={logo}>
          <Mail className="size-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">SES Explorer</p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">LocalStack · SES</p>
        </div>
        {onToggleCollapse && <IconButton icon={PanelLeftClose} label="Recolher menu (Ctrl B)" size="xs" className="-mr-1.5" onClick={onToggleCollapse} />}
      </div>

      <div className="px-2.5 pb-3">
        <button
          onClick={onCompose}
          className="focus-ring group flex h-10 w-full items-center gap-2.5 rounded-xl bg-indigo-600 px-3.5 text-sm font-medium text-white shadow-md shadow-indigo-600/25 transition-all hover:-translate-y-px hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/30 active:translate-y-0 active:scale-[0.98]"
        >
          <PenSquare className="size-4 transition-transform duration-300 group-hover:-rotate-12" />
          Escrever
          <kbd className="ml-auto rounded bg-white/15 px-1.5 font-sans text-[10px]">c</kbd>
        </button>
      </div>

      <nav className="space-y-px px-2.5">
        {nav.map((n) => {
          const active = route.kind === n.kind
          return (
            <a key={n.kind} href={routeHref({ kind: n.kind })} onClick={onNavigate} className={linkCls(active)}>
              <n.icon className={`size-4 transition-colors ${active ? 'text-indigo-500' : 'opacity-70'} ${active && n.kind === 'starred' ? 'fill-current' : ''}`} />
              {n.label}
              <Count n={n.count} strong={n.strong && active} />
            </a>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-3">
        <LabelsSection route={route} counts={labelCounts} onNavigate={onNavigate} onCreate={onCreateLabel} onEdit={onEditLabel} />
        <Section id="senders" title="Remetentes" icon={AtSign} items={senders} kind="from" route={route} onNavigate={onNavigate} />
        <Section id="recipients" title="Destinatários" icon={Users} items={recipients} kind="to" route={route} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          {dot}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs font-medium">
              {statusLabel}
              {region && <span className="ml-1 font-normal text-zinc-400">· {region}</span>}
            </p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={endpoint}>
              {host}
              {updatedAt && ` · ${relativeTime(new Date(updatedAt))}`}
            </p>
          </div>
          <IconButton icon={Settings} label="Preferências" size="xs" onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  )
}
