import {
  CheckCheck,
  FilterX,
  Inbox,
  Mail as MailIcon,
  MailOpen,
  PenSquare,
  RefreshCw,
  Star,
  Pencil,
  StarOff,
  Tag,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Navigate, Route } from '../../hooks/useHashRoute'
import { useFlags } from '../../hooks/useFlags'
import { useInbox } from '../../hooks/useInbox'
import { useLabels } from '../../hooks/useLabels'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { dayLabel, plural } from '../../lib/format'
import { PILLS, inView, matchesQuery, pillMatch, viewTitle, type Pill } from '../../lib/filters'
import type { Label, Mail } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { hasOpenLayer } from '../ui/Dialog'
import { Checkbox } from '../ui/Form'
import { EmptyState } from '../ui/Misc'
import { Tooltip } from '../ui/Tooltip'
import { AttachmentPreview, type PreviewTarget } from './Attachments'
import { LabelMenu } from './Labels'
import { MailReader, ReaderPlaceholder } from './MailReader'
import { MailRow, lineColumns, type RowHandlers, type RowLayout } from './MailRow'

const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

function Skeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800/70" style={{ opacity: 1 - i * 0.09 }}>
          <span className="skeleton size-9 shrink-0 rounded-full!" />
          <div className="flex-1 space-y-2">
            <span className="skeleton block h-3 w-1/3" />
            <span className="skeleton block h-3" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          </div>
          <span className="skeleton h-3 w-10" />
        </div>
      ))}
    </div>
  )
}

export function Mailbox({
  route,
  navigate,
  query,
  onClearQuery,
  onMarkAllRead,
  onClearInbox,
  onCompose,
  onEditLabel,
}: {
  route: Route
  navigate: Navigate
  query: string
  onClearQuery: () => void
  onMarkAllRead: () => void
  onClearInbox: () => void
  onCompose: () => void
  onEditLabel: (l: Label) => void
}) {
  const inbox = useInbox()
  const { flags, set, toggleLabel } = useFlags()
  const { byId: labelsById } = useLabels()
  const currentLabel = route.kind === 'label' && route.value ? labelsById.get(route.value) : undefined
  const rowLabels = (id: string): Label[] => (flags[id]?.labels ?? []).flatMap((l) => labelsById.get(l) ?? [])

  // O marcador da pasta atual foi excluído: volta para a caixa de entrada
  useEffect(() => {
    if (route.kind === 'label' && !currentLabel) navigate({ kind: 'inbox' }, true)
  }, [route.kind, currentLabel, navigate])
  const { settings } = useSettings()
  const toast = useToast()
  const wide = useMediaQuery('(min-width: 1280px)')
  const md = useMediaQuery('(min-width: 768px)')
  const split = settings.readingPane === 'right' && wide
  const layout: RowLayout = split || !md ? 'card' : 'line'

  const [pills, setPills] = useState<Set<Pill>>(() => new Set())
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [cursor, setCursor] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set())
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const anchor = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const openId = route.message
  const mail = useMemo(() => inbox.mails.find((m) => m.id === openId), [inbox.mails, openId])

  // A mensagem aberta continua na lista mesmo que deixe de casar com o filtro (ex.: em "Não lidas" ao ser lida)
  const scoped = useMemo(
    () => inbox.mails.filter((m) => m.id === openId || (inView(m, route, flags[m.id] ?? {}) && matchesQuery(m, query))),
    [inbox.mails, route, flags, query, openId],
  )
  const visible = useMemo(
    () => scoped.filter((m) => m.id === openId || [...pills].every((p) => pillMatch(p, m, flags[m.id] ?? {}))),
    [scoped, pills, flags, openId],
  )
  const columns = useMemo(() => lineColumns(visible), [visible])
  const pillCounts = useMemo(() => {
    const c = {} as Record<Pill, number>
    for (const p of PILLS) c[p.id] = scoped.filter((m) => pillMatch(p.id, m, flags[m.id] ?? {})).length
    return c
  }, [scoped, flags])

  // Seleção só vale para o que está visível
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(visible.map((m) => m.id))
      const next = new Set([...s].filter((id) => ids.has(id)))
      return next.size === s.size ? s : next
    })
  }, [visible])

  useEffect(() => setPills(new Set()), [route.kind, route.value])

  /* ---------------- navegação ---------------- */

  const open = useCallback(
    (id: string, replace = false) => {
      setCursor(id)
      navigate({ kind: route.kind, value: route.value, message: id }, replace)
    },
    [navigate, route.kind, route.value],
  )
  const close = useCallback(() => navigate({ kind: route.kind, value: route.value }), [navigate, route.kind, route.value])

  // Marca como lida ao abrir — uma vez por abertura, para não desfazer o "marcar como não lida"
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (!openId || !mail || marked.current === openId) return
    marked.current = openId
    if (settings.markReadOnOpen) set(openId, { read: true })
  }, [openId, mail, settings.markReadOnOpen, set])
  useEffect(() => {
    if (!openId) marked.current = null
  }, [openId])

  const index = openId ? visible.findIndex((m) => m.id === openId) : -1
  const prev = index > 0 ? visible[index - 1] : undefined
  const next = index >= 0 ? visible[index + 1] : undefined

  // Mantém a linha atual à vista ao navegar pelo teclado
  useEffect(() => {
    const id = openId ?? cursor
    if (!id) return
    listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [openId, cursor])

  /* ---------------- ações ---------------- */

  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      if (openId && ids.includes(openId)) {
        const i = visible.findIndex((m) => m.id === openId)
        const after = visible.slice(i + 1).find((m) => !ids.includes(m.id)) ?? visible.slice(0, Math.max(i, 0)).reverse().find((m) => !ids.includes(m.id))
        if (after) open(after.id, true)
        else close()
      }
      setLeaving((s) => new Set([...s, ...ids]))
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))))
      // espera a animação de saída da linha antes de tirar da lista
      window.setTimeout(() => {
        inbox
          .remove(ids)
          .then(() => toast('success', ids.length === 1 ? 'Mensagem excluída' : `${plural(ids.length, 'mensagem excluída', 'mensagens excluídas')}`))
          .catch((e: Error) => toast('error', 'Não deu para excluir', e.message))
          .finally(() => setLeaving((s) => new Set([...s].filter((id) => !ids.includes(id)))))
      }, 240)
    },
    [openId, visible, open, close, inbox, toast],
  )

  const toggleSelect = useCallback(
    (id: string, range: boolean) => {
      setSelected((s) => {
        const nextSel = new Set(s)
        if (range && anchor.current) {
          const a = visible.findIndex((m) => m.id === anchor.current)
          const b = visible.findIndex((m) => m.id === id)
          if (a >= 0 && b >= 0) {
            for (const m of visible.slice(Math.min(a, b), Math.max(a, b) + 1)) nextSel.add(m.id)
            return nextSel
          }
        }
        if (nextSel.has(id)) nextSel.delete(id)
        else nextSel.add(id)
        return nextSel
      })
      anchor.current = id
    },
    [visible],
  )

  // Handlers estáveis para as linhas memoizadas
  const latest = useRef<RowHandlers>(null as unknown as RowHandlers)
  latest.current = {
    onOpen: (id) => open(id),
    onSelect: toggleSelect,
    onStar: (id, on) => set(id, { starred: on }),
    onRead: (id, read) => set(id, { read }),
    onDelete: (id) => remove([id]),
    onPreview: (m, i) => setPreview({ mailId: m.id, files: m.files, index: i }),
  }
  const handlers = useMemo<RowHandlers>(
    () => ({
      onOpen: (id) => latest.current.onOpen(id),
      onSelect: (id, r) => latest.current.onSelect(id, r),
      onStar: (id, on) => latest.current.onStar(id, on),
      onRead: (id, r) => latest.current.onRead(id, r),
      onDelete: (id) => latest.current.onDelete(id),
      onPreview: (m, i) => latest.current.onPreview(m, i),
    }),
    [],
  )

  const clearFilters = useCallback(() => {
    setPills(new Set())
    onClearQuery()
  }, [onClearQuery])

  /* ---------------- teclado ---------------- */

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || hasOpenLayer()) return
      const base = openId ?? cursor
      const target = openId ?? cursor ?? undefined
      const move = (d: number) => {
        if (!visible.length) return
        const i = base ? visible.findIndex((m) => m.id === base) : -1
        const to = visible[Math.max(0, Math.min(visible.length - 1, i < 0 ? 0 : i + d))]
        if (openId || split) open(to.id, true)
        else setCursor(to.id)
      }
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          move(1)
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          move(-1)
          break
        case 'Enter':
        case 'o': {
          const id = cursor ?? visible[0]?.id
          if (id && id !== openId) open(id)
          break
        }
        case 'Escape':
          if (selected.size) setSelected(new Set())
          else if (openId) close()
          else if (pills.size || query) clearFilters()
          break
        case 'l': {
          // abre o menu de marcadores da seleção (barra em lote) ou da mensagem aberta
          const trigger = selected.size
            ? listRef.current?.parentElement?.querySelector<HTMLButtonElement>('[data-label-trigger]')
            : document.querySelector<HTMLButtonElement>('[data-reader] [data-label-trigger]')
          if (trigger) {
            e.preventDefault()
            trigger.click()
          }
          break
        }
        case 'x':
          if (target) toggleSelect(target, false)
          break
        case 's':
          if (target) set(target, { starred: !flags[target]?.starred })
          break
        case 'u':
          if (selected.size) set([...selected], { read: false })
          else if (openId) {
            set(openId, { read: false })
            if (!split) close()
          } else if (cursor) set(cursor, { read: !flags[cursor]?.read })
          break
        case '#':
        case 'Delete':
          remove(selected.size ? [...selected] : target ? [target] : [])
          break
        case 'r':
          void inbox.refresh()
          break
        default:
          return
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [visible, openId, cursor, split, selected, pills, query, flags, open, close, toggleSelect, set, remove, clearFilters, inbox])

  /* ---------------- render ---------------- */

  const unreadTotal = inbox.mails.filter((m) => !flags[m.id]?.read).length
  const allSelected = visible.length > 0 && visible.every((m) => selected.has(m.id))
  const selecting = selected.size > 0
  const firstLoad = inbox.loading && inbox.updatedAt === null && inbox.mails.length === 0

  const groups: { label: string; items: Mail[] }[] = []
  for (const m of visible) {
    const label = dayLabel(m.ts)
    const g = groups[groups.length - 1]
    if (g?.label === label) g.items.push(m)
    else groups.push({ label, items: [m] })
  }

  let order = 0
  const listBody = firstLoad ? (
    <Skeleton />
  ) : inbox.status === 'offline' && inbox.mails.length === 0 ? (
    <EmptyState
      icon={WifiOff}
      tone="error"
      title="Sem conexão com o LocalStack"
      action={
        <Button icon={RefreshCw} onClick={() => inbox.refresh()} loading={inbox.loading}>
          Tentar de novo
        </Button>
      }
    >
      <p>{inbox.error}</p>
      <p className="mt-2 text-xs">
        A lista volta sozinha quando o container responder. Teste com{' '}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono dark:bg-zinc-800">curl {inbox.endpoint || 'http://localhost:4566'}/_aws/ses</code>
      </p>
    </EmptyState>
  ) : visible.length === 0 ? (
    inbox.mails.length > 0 ? (
      <EmptyState
        icon={FilterX}
        title="Nada por aqui com esses filtros"
        action={
          <>
            {(query || pills.size > 0) && (
              <Button icon={FilterX} onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
            {route.kind !== 'inbox' && (
              <Button icon={Inbox} onClick={() => navigate({ kind: 'inbox' })}>
                Ver caixa de entrada
              </Button>
            )}
          </>
        }
      >
        {query ? (
          <>
            Nenhuma mensagem contém “<b className="font-medium text-zinc-700 dark:text-zinc-200">{query}</b>”.
          </>
        ) : (
          'Tente outro filtro rápido ou outra pasta.'
        )}
      </EmptyState>
    ) : (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div className="animate-float mb-6 flex size-20 items-center justify-center rounded-3xl bg-linear-to-br from-sky-400 to-indigo-600 text-white shadow-xl shadow-indigo-500/25">
          <Inbox className="size-9" strokeWidth={1.6} />
        </div>
        <h3 className="text-base font-semibold">Sua caixa de entrada está vazia</h3>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Assim que a aplicação enviar um e-mail pelo SES do LocalStack, ele aparece aqui
          {settings.refreshMs ? ` — a lista se atualiza a cada ${settings.refreshMs / 1000} s` : ''}.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={PenSquare} onClick={onCompose}>
            Enviar e-mail de teste
          </Button>
          <Button icon={RefreshCw} onClick={() => inbox.refresh()} loading={inbox.loading}>
            Atualizar
          </Button>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          ou rode <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono dark:bg-zinc-800">npm run seed</code> para criar exemplos
        </p>
      </div>
    )
  ) : (
    groups.map((g) => (
      <Fragment key={g.label}>
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-zinc-100 bg-white/90 px-4 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/90 dark:text-zinc-500">
          {g.label}
          <span className="font-normal">{g.items.length}</span>
        </div>
        {g.items.map((m) => (
          <MailRow
            key={m.id}
            mail={m}
            flags={flags[m.id] ?? {}}
            labels={rowLabels(m.id)}
            layout={layout}
            density={settings.density}
            query={query}
            active={m.id === openId}
            cursor={m.id === cursor && m.id !== openId}
            selected={selected.has(m.id)}
            selecting={selecting}
            fresh={inbox.fresh.has(m.id)}
            leaving={leaving.has(m.id)}
            order={order++}
            {...handlers}
          />
        ))}
      </Fragment>
    ))
  )

  const listPane = (
    <section
      className={`flex min-h-0 min-w-0 flex-col bg-white dark:bg-zinc-900/40 ${split ? 'w-[440px] shrink-0 border-r border-zinc-200 2xl:w-[520px] dark:border-zinc-800' : 'flex-1'} ${
        !split && openId ? 'hidden' : ''
      }`}
    >
      <header className="flex items-end gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {currentLabel ? (
              <>
                <Tag className="size-4 shrink-0" style={{ color: currentLabel.color }} />
                <span className="truncate">{currentLabel.name}</span>
                <IconButton icon={Pencil} label="Editar marcador" size="xs" onClick={() => onEditLabel(currentLabel)} />
              </>
            ) : (
              viewTitle(route)
            )}
            {route.value && route.kind !== 'label' && (
              <span className="animate-pop-in inline-flex min-w-0 items-center gap-1 rounded-full bg-indigo-50 py-0.5 pr-1 pl-2.5 text-[13px] font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/25">
                <span className="truncate">{route.value}</span>
                <button
                  onClick={() => navigate({ kind: 'inbox' })}
                  className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                  aria-label="Remover filtro"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {plural(scoped.length, 'mensagem', 'mensagens')}
            {unreadTotal > 0 && ` · ${plural(unreadTotal, 'não lida', 'não lidas')} no total`}
          </p>
        </div>
      </header>

      {inbox.status === 'offline' && inbox.mails.length > 0 && (
        <div className="animate-bar-in mx-3 mb-2 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25">
          <WifiOff className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={inbox.error ?? ''}>
            Sem resposta do LocalStack — mostrando a última lista. {inbox.error}
          </span>
          <button onClick={() => inbox.refresh()} className="font-semibold hover:underline">
            Tentar de novo
          </button>
        </div>
      )}

      {/* No celular os filtros rápidos descem para uma segunda linha rolável; do sm para cima, tudo numa linha */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-1 border-y border-zinc-200 px-2 py-1 sm:h-11 sm:flex-nowrap sm:py-0 dark:border-zinc-800">
        <span className="flex size-8 items-center justify-center">
          <Checkbox
            checked={allSelected}
            indeterminate={selecting && !allSelected}
            onChange={(v) => setSelected(v ? new Set(visible.map((m) => m.id)) : new Set())}
          />
        </span>
        {selecting ? (
          <div key="bulk" className="animate-bar-in flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
            <span className="mr-1.5 text-[13px] font-medium whitespace-nowrap text-indigo-600 tabular-nums dark:text-indigo-300">
              {selected.size}
              <span className="max-sm:hidden"> selecionada{selected.size > 1 ? 's' : ''}</span>
            </span>
            <IconButton icon={MailOpen} label="Marcar como lidas" onClick={() => set([...selected], { read: true })} />
            <IconButton icon={MailIcon} label="Marcar como não lidas" onClick={() => set([...selected], { read: false })} />
            <IconButton icon={Star} label="Adicionar estrela" onClick={() => set([...selected], { starred: true })} />
            <IconButton icon={StarOff} label="Remover estrela" className="max-sm:hidden" onClick={() => set([...selected], { starred: false })} />
            <LabelMenu ids={[...selected]} />
            <IconButton icon={Trash2} label="Excluir selecionadas (#)" tone="danger" onClick={() => remove([...selected])} />
            <div className="flex-1" />
            <IconButton icon={X} label="Limpar seleção (Esc)" onClick={() => setSelected(new Set())} />
          </div>
        ) : (
          <>
          <div key="tools" className="animate-fade-in flex shrink-0 items-center gap-0.5">
            <IconButton
              icon={RefreshCw}
              label="Atualizar (r)"
              onClick={() => inbox.refresh()}
              className={inbox.loading ? '[&>svg]:animate-spin' : ''}
            />
            <IconButton icon={CheckCheck} label="Marcar todas como lidas" onClick={onMarkAllRead} disabled={!unreadTotal} />
            <IconButton icon={Trash2} label="Limpar caixa no LocalStack" tone="danger" onClick={onClearInbox} disabled={!inbox.mails.length} />
            <span className="mx-1.5 h-5 w-px shrink-0 bg-zinc-200 max-sm:hidden dark:bg-zinc-800" />
          </div>
            <div className="animate-fade-in flex min-w-0 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] max-sm:order-last max-sm:-mx-2 max-sm:w-[calc(100%+1rem)] max-sm:px-2 max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:flex-1">
              {PILLS.map((p) => {
                const on = pills.has(p.id)
                const pill = (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPills((s) => {
                        const n = new Set(s)
                        if (n.has(p.id)) n.delete(p.id)
                        else n.add(p.id)
                        return n
                      })
                    }
                    className={`focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                      on
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'text-zinc-600 ring-1 ring-zinc-200 ring-inset hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <p.icon className={`size-3.5 ${on && p.id === 'starred' ? 'fill-current' : ''}`} />
                    <span className={split ? 'hidden 2xl:inline' : ''}>{p.label}</span>
                    <span className={`tabular-nums ${on ? 'text-white/80' : 'text-zinc-400'}`}>{pillCounts[p.id]}</span>
                  </button>
                )
                return split ? (
                  <Tooltip key={p.id} label={p.label} side="bottom">
                    {pill}
                  </Tooltip>
                ) : (
                  pill
                )
              })}
              {/* respiro para o último filtro não ficar sob o esmaecido no celular */}
              <span className="w-6 shrink-0 sm:hidden" />
            </div>
          </>
        )}
        <span className={`ml-auto shrink-0 pl-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400 ${selecting ? 'max-sm:hidden' : ''}`}>
          {visible.length !== scoped.length ? `${visible.length} de ${scoped.length}` : visible.length || ''}
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" style={layout === 'line' ? columns : undefined}>
        {listBody}
      </div>
    </section>
  )

  const position = { index, total: visible.length }
  const reader = openId ? (
    <MailReader
      mail={mail}
      loading={inbox.loading || inbox.updatedAt === null}
      flags={flags[openId] ?? {}}
      position={position}
      split={split}
      onClose={close}
      onPrev={prev && (() => open(prev.id, true))}
      onNext={next && (() => open(next.id, true))}
      onStar={(on) => set(openId, { starred: on })}
      onRead={(read) => {
        set(openId, { read })
        if (!read && !split) close()
      }}
      onDelete={() => remove([openId])}
      onPreview={(i) => mail && setPreview({ mailId: mail.id, files: mail.files, index: i })}
      labels={rowLabels(openId)}
      onRemoveLabel={(labelId) => toggleLabel([openId], labelId, false)}
    />
  ) : (
    <ReaderPlaceholder total={inbox.mails.length} unread={unreadTotal} />
  )

  return (
    <div className="flex h-full min-h-0">
      {listPane}
      {(split || openId) && <section className="min-h-0 min-w-0 flex-1 bg-white dark:bg-zinc-900/20">{reader}</section>}
      <AttachmentPreview target={preview} onClose={() => setPreview(null)} onMove={(i) => setPreview((p) => p && { ...p, index: i })} />
    </div>
  )
}
