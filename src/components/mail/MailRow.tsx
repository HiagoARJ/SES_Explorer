import { Download, Mail as MailIcon, MailOpen, Paperclip, Trash2 } from 'lucide-react'
import { memo } from 'react'
import type { Density } from '../../hooks/useSettings'
import { sourceUrl } from '../../lib/api'
import { fullDate, shortDate, triggerDownload } from '../../lib/format'
import { parseAddress } from '../../lib/mail'
import type { Flags, Label, Mail } from '../../lib/types'
import { IconButton } from '../ui/Button'
import { AttachmentChip } from './Attachments'
import { Highlight, SelectAvatar, StarButton } from './Bits'
import { LabelChip } from './Labels'

export type RowLayout = 'line' | 'card'

export interface RowHandlers {
  onOpen: (id: string) => void
  onSelect: (id: string, range: boolean) => void
  onStar: (id: string, on: boolean) => void
  onRead: (id: string, read: boolean) => void
  onDelete: (id: string) => void
  onPreview: (mail: Mail, index: number) => void
}

interface Props extends RowHandlers {
  mail: Mail
  flags: Flags
  /** Marcadores da mensagem, já resolvidos */
  labels: Label[]
  layout: RowLayout
  density: Density
  query: string
  active: boolean
  cursor: boolean
  selected: boolean
  selecting: boolean
  fresh: boolean
  leaving: boolean
  /** posição na lista, para o atraso da animação de entrada */
  order: number
}

export const recipientLabel = (m: Mail) => {
  const first = m.to[0] ? parseAddress(m.to[0]).name : m.region
  const more = m.to.length + m.cc.length - 1
  return more > 0 ? `${first} +${more}` : first
}

/**
 * Larguras das colunas de remetente e destinatário no modo lista: acompanham o maior nome
 * visível (com teto), para não sobrar espaço com nomes curtos e manter o assunto alinhado.
 */
export function lineColumns(mails: Mail[]): Record<string, string> {
  const longest = (f: (m: Mail) => string) => mails.reduce((n, m) => Math.max(n, [...f(m)].length), 0)
  const from = Math.min(22, Math.max(6, longest((m) => m.fromName)))
  // a etiqueta usa fonte de 11px (≈ 0,8 do ch de 14px) + padding
  const to = Math.min(16, Math.max(4, longest(recipientLabel)))
  return { '--from-w': `${from + 1}ch`, '--to-w': `calc(${to * 0.8}ch + 0.75rem)` }
}

function MailRowImpl(p: Props) {
  const { mail: m, flags, layout, density, query, active, cursor, selected, selecting, fresh, leaving } = p
  const unread = !flags.read
  const compact = density === 'compact'
  const files = m.files
  const tags = (max: number) => (
    <>
      {p.labels.slice(0, max).map((l) => (
        <LabelChip key={l.id} label={l} className="self-center" />
      ))}
      {p.labels.length > max && <span className="shrink-0 self-center text-[11px] text-zinc-400">+{p.labels.length - max}</span>}
    </>
  )

  const surface = selected
    ? 'bg-sky-50 dark:bg-sky-500/10'
    : active
      ? 'bg-indigo-50 shadow-[inset_0_0_0_1px] shadow-indigo-200 dark:bg-indigo-500/15 dark:shadow-indigo-500/30'
      : unread
        ? 'bg-white dark:bg-zinc-900'
        : 'bg-zinc-50/60 dark:bg-zinc-950/30'

  const actions = (
    <div className="flex items-center gap-0.5 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 focus-within:opacity-100 sm:translate-x-1">
      <IconButton
        icon={unread ? MailOpen : MailIcon}
        label={unread ? 'Marcar como lida' : 'Marcar como não lida'}
        size="xs"
        onClick={(e) => {
          e.stopPropagation()
          p.onRead(m.id, unread)
        }}
      />
      <IconButton
        icon={Download}
        label="Baixar .eml"
        size="xs"
        onClick={(e) => {
          e.stopPropagation()
          triggerDownload(sourceUrl(m.id, true))
        }}
      />
      <IconButton
        icon={Trash2}
        label="Excluir (#)"
        size="xs"
        tone="danger"
        onClick={(e) => {
          e.stopPropagation()
          p.onDelete(m.id)
        }}
      />
    </div>
  )

  const chips = (max: number) =>
    files.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5">
        {files.slice(0, max).map((a, i) => (
          <AttachmentChip key={a.index} mailId={m.id} file={a} onPreview={() => p.onPreview(m, i)} />
        ))}
        {files.length > max && <span className="text-[11px] text-zinc-400">+{files.length - max}</span>}
      </div>
    )

  return (
    <div
      className={`collapsible animate-row-in ${leaving ? 'is-leaving' : ''}`}
      style={{ animationDelay: `${Math.min(p.order, 14) * 22}ms` }}
      data-id={m.id}
    >
      <div>
        <div
          role="row"
          aria-selected={active}
          onClick={(e) => (e.shiftKey ? p.onSelect(m.id, true) : p.onOpen(m.id))}
          className={`group relative cursor-pointer border-b border-zinc-100 transition-[background-color,box-shadow] duration-150 hover:z-10 hover:shadow-[0_1px_6px_-1px_rgb(0_0_0/0.12)] dark:border-zinc-800/70 dark:hover:shadow-[0_1px_8px_-1px_rgb(0_0_0/0.6)] ${surface} ${
            fresh ? 'animate-flash' : ''
          } ${cursor ? 'ring-1 ring-indigo-400/70 ring-inset' : ''}`}
        >
          {/* barra de não lida: cresce/encolhe ao marcar */}
          <span
            className={`absolute inset-y-0 left-0 w-[3px] origin-left bg-indigo-500 transition-transform duration-200 ${unread ? 'scale-x-100' : 'scale-x-0'}`}
          />

          {layout === 'line' ? (
            // Grid de colunas fixas: o assunto começa sempre no mesmo x e os anexos ficam alinhados com ele
            <div
              className={`grid grid-cols-[auto_auto_var(--from-w,8rem)_var(--to-w,6.5rem)_minmax(0,1fr)_6rem] items-center gap-x-2 pr-3 pl-3 ${
                compact ? 'grid-rows-[2.5rem_auto]' : 'grid-rows-[3rem_auto]'
              }`}
            >
                <SelectAvatar
                  name={m.fromName}
                  email={m.fromEmail}
                  selected={selected}
                  selecting={selecting}
                  onToggle={(e) => p.onSelect(m.id, e.shiftKey)}
                  className={compact ? 'size-7 text-[11px]' : 'size-8 text-xs'}
                />
                <StarButton on={!!flags.starred} onToggle={() => p.onStar(m.id, !flags.starred)} />
                <span
                  className={`truncate text-sm ${unread ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}
                  title={m.source}
                >
                  <Highlight text={m.fromName} query={query} />
                </span>
                <span
                  className="max-w-full justify-self-end truncate rounded-md bg-zinc-100 px-1.5 text-[11px] leading-5 text-zinc-500 ring-1 ring-zinc-200 ring-inset dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                  title={[...m.to, ...m.cc].join(', ')}
                >
                  {recipientLabel(m)}
                </span>
                <span className="flex min-w-0 items-baseline gap-2">
                  {tags(3)}
                  <span
                    className={`max-w-[60%] shrink-0 truncate text-sm ${unread ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}
                  >
                    <Highlight text={m.subject} query={query} />
                  </span>
                  <span className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    — <Highlight text={m.snippet} query={query} />
                  </span>
                </span>
                <div className="relative flex items-center justify-end">
                  <span className="flex items-center gap-1.5 transition-opacity group-hover:opacity-0">
                    {files.length > 0 && <Paperclip className="size-3.5 text-zinc-400" />}
                    <span
                      className={`text-xs tabular-nums ${unread ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}
                      title={fullDate(m.ts)}
                    >
                      {shortDate(m.ts)}
                    </span>
                  </span>
                  <div className="absolute right-0">{actions}</div>
                </div>
                {files.length > 0 && !compact && <div className="col-span-2 col-start-5 -mt-1 pb-2">{chips(4)}</div>}
            </div>
          ) : (
            <div className={`flex gap-3 pr-3 pl-4 ${compact ? 'py-2' : 'py-3'}`}>
              <SelectAvatar
                name={m.fromName}
                email={m.fromEmail}
                selected={selected}
                selecting={selecting}
                onToggle={(e) => p.onSelect(m.id, e.shiftKey)}
                className={compact ? 'mt-0.5 size-8 text-xs' : 'mt-0.5 size-9 text-sm'}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}
                    title={m.source}
                  >
                    <Highlight text={m.fromName} query={query} />
                  </span>
                  <div className="relative flex shrink-0 items-center">
                    <span className="flex items-center gap-1.5 transition-opacity group-hover:opacity-0">
                      {files.length > 0 && <Paperclip className="size-3.5 text-zinc-400" />}
                      <span
                        className={`text-xs tabular-nums ${unread ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400'}`}
                        title={fullDate(m.ts)}
                      >
                        {shortDate(m.ts)}
                      </span>
                    </span>
                    <div className="absolute -top-1 right-0">{actions}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {tags(2)}
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${unread ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}
                  >
                    <Highlight text={m.subject} query={query} />
                  </span>
                  <StarButton on={!!flags.starred} onToggle={() => p.onStar(m.id, !flags.starred)} className="-my-1 -mr-1" />
                </div>
                <p className={`text-[13px] text-zinc-500 dark:text-zinc-400 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
                  <span className="mr-1 text-zinc-400 dark:text-zinc-500">para {recipientLabel(m)} ·</span>
                  <Highlight text={m.snippet} query={query} />
                </p>
                {!compact && files.length > 0 && <div className="mt-2">{chips(2)}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const MailRow = memo(MailRowImpl)
