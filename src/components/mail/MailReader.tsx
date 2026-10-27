import {
  ArrowLeft,
  Braces,
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  Link2,
  Mail as MailIcon,
  MailOpen,
  MailQuestion,
  Monitor,
  MoreVertical,
  Paperclip,
  Printer,
  Smartphone,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { api, sourceUrl } from '../../lib/api'
import { copyText, formatBytes, fullDate, plural, relativeTime, triggerDownload } from '../../lib/format'
import { extractLinks, openStandalone, parseAddress, plainMessage } from '../../lib/mail'
import type { Flags, Label, Mail } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Badge, DetailRow, EmptyState, MenuItem, Popover, Segmented, Spinner } from '../ui/Misc'
import { AttachmentCard } from './Attachments'
import { Avatar, JsonView, StarButton } from './Bits'
import { LabelChip, LabelMenu } from './Labels'
import { MailFrame } from './MailFrame'

type Tab = 'html' | 'text' | 'links' | 'source' | 'json'

function Source({ id }: { id: string }) {
  const [state, setState] = useState<{ text?: string; error?: string }>({})
  useEffect(() => {
    let alive = true
    setState({})
    api
      .source(id)
      .then((text) => alive && setState({ text }))
      .catch((e: Error) => alive && setState({ error: e.message }))
    return () => {
      alive = false
    }
  }, [id])
  if (state.error) return <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
  if (state.text === undefined)
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-5 text-zinc-400" />
      </div>
    )
  const LIMIT = 200_000
  return (
    <div className="animate-fade-in">
      {state.text.length > LIMIT && (
        <p className="mb-2 text-xs text-zinc-500">
          Mostrando os primeiros {formatBytes(LIMIT)} de {formatBytes(state.text.length)}. Use “Abrir em nova aba” para ver tudo.
        </p>
      )}
      <pre className="max-h-[70vh] overflow-auto rounded-xl bg-zinc-50 p-4 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
        {state.text.slice(0, LIMIT)}
      </pre>
    </div>
  )
}

function Links({ mail }: { mail: Mail }) {
  const toast = useToast()
  const links = useMemo(() => extractLinks(mail), [mail])
  if (!links.length)
    return (
      <EmptyState icon={Link2} title="Nenhum link neste e-mail">
        Links de confirmação, redefinição de senha e afins aparecem aqui para abrir ou copiar.
      </EmptyState>
    )
  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800">
      {links.map((l, i) => (
        <li
          key={l.href}
          className="animate-row-in group flex items-center gap-3 bg-white px-3 py-2.5 dark:bg-zinc-900"
          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
        >
          <Link2 className="size-4 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            {l.text && <p className="truncate text-[13px] font-medium">{l.text}</p>}
            <p className="truncate font-mono text-[12px] text-indigo-600 dark:text-indigo-300" title={l.href}>
              {l.href}
            </p>
          </div>
          <IconButton
            icon={Copy}
            label="Copiar link"
            size="xs"
            onClick={async () => ((await copyText(l.href)) ? toast('success', 'Link copiado') : toast('error', 'O navegador bloqueou a cópia'))}
          />
          <IconButton icon={ExternalLink} label="Abrir em nova aba" size="xs" onClick={() => window.open(l.href, '_blank', 'noopener')} />
        </li>
      ))}
    </ul>
  )
}

export function ReaderPlaceholder({ total, unread }: { total: number; unread: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="animate-float mb-5 flex size-20 items-center justify-center rounded-3xl bg-linear-to-br from-sky-400 to-indigo-600 text-white shadow-xl shadow-indigo-500/25">
        <MailOpen className="size-9" strokeWidth={1.6} />
      </div>
      <h2 className="text-base font-semibold">Nenhuma mensagem selecionada</h2>
      <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
        {total ? `${plural(total, 'mensagem', 'mensagens')} · ${plural(unread, 'não lida', 'não lidas')}` : 'A caixa está vazia.'}
      </p>
      <p className="mt-4 text-xs text-zinc-400">
        <kbd className="font-sans font-semibold">j</kbd>/<kbd className="font-sans font-semibold">k</kbd> navegam ·{' '}
        <kbd className="font-sans font-semibold">?</kbd> mostra todos os atalhos
      </p>
    </div>
  )
}

export function MailReader({
  mail,
  loading,
  flags,
  position,
  split,
  onClose,
  onPrev,
  onNext,
  onStar,
  onRead,
  onDelete,
  onPreview,
  labels,
  onRemoveLabel,
}: {
  mail?: Mail
  loading: boolean
  flags: Flags
  position: { index: number; total: number }
  split: boolean
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  onStar: (on: boolean) => void
  onRead: (read: boolean) => void
  onDelete: () => void
  onPreview: (index: number) => void
  labels: Label[]
  onRemoveLabel: (labelId: string) => void
}) {
  const toast = useToast()
  const { settings, update } = useSettings()
  const [tab, setTab] = useState<Tab>('html')
  const [details, setDetails] = useState(false)
  const [showHeaders, setShowHeaders] = useState(false)
  const links = useMemo(() => (mail ? extractLinks(mail).length : 0), [mail])

  useEffect(() => {
    setDetails(false)
    setShowHeaders(false)
  }, [mail?.id])

  const toolbar = (
    <div className="flex h-12 shrink-0 items-center gap-0.5 border-b border-zinc-200 px-2 dark:border-zinc-800">
      <IconButton icon={split ? X : ArrowLeft} label={split ? 'Fechar (Esc)' : 'Voltar (Esc)'} onClick={onClose} />
      {mail && (
        <>
          <span className="mx-1.5 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
          <IconButton
            icon={flags.read ? MailIcon : MailOpen}
            label={flags.read ? 'Marcar como não lida (u)' : 'Marcar como lida'}
            onClick={() => onRead(!flags.read)}
          />
          <IconButton icon={Trash2} label="Excluir (#)" tone="danger" onClick={onDelete} />
          <LabelMenu ids={[mail.id]} />
          <IconButton icon={Download} label="Baixar .eml" onClick={() => triggerDownload(sourceUrl(mail.id, true))} />
          <Popover
            trigger={({ toggle, open }) => <IconButton icon={MoreVertical} label="Mais ações" active={open} onClick={toggle} />}
            align="left"
          >
            {(close) => (
              <>
                <MenuItem
                  icon={Printer}
                  onClick={() => {
                    close()
                    if (!openStandalone(mail, true)) toast('error', 'O navegador bloqueou a nova aba')
                  }}
                >
                  Imprimir
                </MenuItem>
                <MenuItem
                  icon={ExternalLink}
                  onClick={() => {
                    close()
                    if (!openStandalone(mail)) toast('error', 'O navegador bloqueou a nova aba')
                  }}
                >
                  Abrir HTML em nova aba
                </MenuItem>
                <MenuItem
                  icon={FileCode}
                  onClick={() => {
                    close()
                    window.open(sourceUrl(mail.id), '_blank', 'noopener')
                  }}
                >
                  Ver original
                </MenuItem>
                <MenuItem
                  icon={Copy}
                  onClick={async () => {
                    close()
                    if (await copyText(mail.html || mail.text)) toast('success', mail.html ? 'HTML copiado' : 'Texto copiado')
                    else toast('error', 'O navegador bloqueou a cópia')
                  }}
                >
                  Copiar {mail.html ? 'HTML' : 'texto'}
                </MenuItem>
                <MenuItem
                  icon={Copy}
                  onClick={async () => {
                    close()
                    if (await copyText(mail.id)) toast('success', 'Message-Id copiado', mail.id)
                  }}
                >
                  Copiar Message-Id
                </MenuItem>
              </>
            )}
          </Popover>
        </>
      )}
      <div className="flex-1" />
      {mail && position.index >= 0 && (
        <span className="mr-1 hidden text-xs text-zinc-500 tabular-nums sm:inline dark:text-zinc-400">
          {position.index + 1} de {position.total}
        </span>
      )}
      <IconButton icon={ChevronUp} label="Mais recente (k)" onClick={onPrev} disabled={!onPrev} />
      <IconButton icon={ChevronDown} label="Mais antiga (j)" onClick={onNext} disabled={!onNext} />
    </div>
  )

  if (!mail) {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-5 text-zinc-400" />
          </div>
        ) : (
          <EmptyState
            icon={MailQuestion}
            title="Mensagem não encontrada"
            action={
              <Button icon={ArrowLeft} onClick={onClose}>
                Voltar para a lista
              </Button>
            }
          >
            Ela pode ter sido excluída ou o LocalStack foi reiniciado sem persistência.
          </EmptyState>
        )}
      </div>
    )
  }

  const view: Tab = tab === 'html' && !mail.html ? 'text' : tab
  const all = [...mail.to, ...mail.cc]
  const recipients = all.slice(0, 2).map((a) => parseAddress(a).name).join(', ') + (all.length > 2 ? ` +${all.length - 2}` : '')
  const kind = mail.template ? 'Template' : mail.raw ? 'SendRawEmail' : 'SendEmail'

  return (
    <div data-reader className="flex h-full min-w-0 flex-col">
      {toolbar}
      <div data-scroll className="min-h-0 flex-1 overflow-y-auto">
        <article key={mail.id} className="animate-reader-in mx-auto max-w-5xl px-4 pt-5 pb-10 sm:px-8">
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-xl leading-snug font-semibold tracking-tight text-balance break-words">{mail.subject}</h1>
            <StarButton on={!!flags.starred} onToggle={() => onStar(!flags.starred)} className="mt-0.5" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {labels.map((l) => (
              <LabelChip key={l.id} label={l} link onRemove={() => onRemoveLabel(l.id)} />
            ))}
            <Badge tone={mail.template ? 'violet' : mail.raw ? 'sky' : 'neutral'}>{kind}</Badge>
            {mail.region && <Badge>{mail.region}</Badge>}
            {mail.files.length > 0 && (
              <Badge icon={Paperclip} tone="amber">
                {plural(mail.files.length, 'anexo', 'anexos')}
              </Badge>
            )}
            <Badge>{formatBytes(mail.size)}</Badge>
          </div>

          <div className="mt-5 flex items-start gap-3">
            <Avatar name={mail.fromName} email={mail.fromEmail} className="size-10 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-semibold">{mail.fromName}</span>{' '}
                {mail.fromName !== mail.fromEmail && <span className="text-[13px] text-zinc-500 dark:text-zinc-400">&lt;{mail.fromEmail}&gt;</span>}
              </p>
              <button
                type="button"
                onClick={() => setDetails((d) => !d)}
                aria-expanded={details}
                className="focus-ring -ml-1 inline-flex max-w-full items-center gap-1 rounded px-1 text-[13px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span className="truncate">para {recipients || '—'}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform duration-200 ${details ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
              <p title={mail.ts.toLocaleString('pt-BR')}>{fullDate(mail.ts)}</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">{relativeTime(mail.ts)}</p>
            </div>
          </div>

          <div className={`collapsible ${details ? '' : 'is-closed'}`}>
            <div>
              <dl className="mt-3 divide-y divide-zinc-100 rounded-xl bg-zinc-50/80 px-4 py-1 ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900/60 dark:ring-zinc-800">
                <DetailRow label="De">{mail.source || '—'}</DetailRow>
                <DetailRow label="Para">{mail.to.join(', ') || '—'}</DetailRow>
                {mail.cc.length > 0 && <DetailRow label="Cc">{mail.cc.join(', ')}</DetailRow>}
                {mail.bcc.length > 0 && <DetailRow label="Cco">{mail.bcc.join(', ')}</DetailRow>}
                {mail.replyTo.length > 0 && <DetailRow label="Responder para">{mail.replyTo.join(', ')}</DetailRow>}
                <DetailRow label="Data">{mail.ts.toLocaleString('pt-BR')}</DetailRow>
                <DetailRow label="Envio">{kind}</DetailRow>
                <DetailRow label="Região">{mail.region || '—'}</DetailRow>
                <DetailRow label="Message-Id" mono>
                  {mail.id}
                </DetailRow>
                {mail.headers.length > 0 && (
                  <div className="py-2">
                    <button
                      type="button"
                      onClick={() => setShowHeaders((s) => !s)}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      {showHeaders ? 'Ocultar' : 'Mostrar'} todos os cabeçalhos ({mail.headers.length})
                      <ChevronDown className={`size-3.5 transition-transform ${showHeaders ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`collapsible ${showHeaders ? '' : 'is-closed'}`}>
                      <div>
                        <div className="mt-2 space-y-1 font-mono text-[11.5px]">
                          {mail.headers.map((h, i) => (
                            <p key={i} className="break-all">
                              <span className="text-sky-700 dark:text-sky-300">{h.name}:</span> {h.value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
              <Segmented
              value={view}
              onChange={setTab}
              options={[
                ...(mail.html ? [{ value: 'html' as const, label: 'HTML', icon: Code }] : []),
                { value: 'text' as const, label: 'Texto', icon: Type },
                { value: 'links' as const, label: links ? `Links ${links}` : 'Links', icon: Link2 },
                { value: 'source' as const, label: 'Original', icon: FileCode },
                { value: 'json' as const, label: 'JSON', icon: Braces },
              ]}
              />
            </div>
            {view === 'html' && (
              <div className="ml-auto shrink-0 max-sm:hidden">
                <Segmented
                  size="xs"
                  value={settings.previewWidth}
                  onChange={(previewWidth) => update({ previewWidth })}
                  options={[
                    { value: 'desktop', label: 'Desktop', icon: Monitor, title: 'Largura total' },
                    { value: 'mobile', label: 'Celular', icon: Smartphone, title: 'Prévia em 390 px' },
                  ]}
                />
              </div>
            )}
          </div>

          <div key={view} className="animate-fade-in mt-4">
            {view === 'html' ? (
              <MailFrame html={mail.html} width={settings.previewWidth} />
            ) : view === 'text' ? (
              <pre className="rounded-xl bg-zinc-50 p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
                {mail.text || (mail.html ? '(sem corpo em texto — veja a aba HTML)' : '(mensagem sem corpo)')}
              </pre>
            ) : view === 'links' ? (
              <Links mail={mail} />
            ) : view === 'source' ? (
              <Source id={mail.id} />
            ) : (
              <JsonView value={plainMessage(mail)} />
            )}
          </div>

          {mail.template && (
            <section className="mt-6 rounded-xl ring-1 ring-violet-200 dark:ring-violet-500/25">
              <h3 className="flex items-center gap-2 border-b border-violet-100 px-4 py-2.5 text-sm font-semibold dark:border-violet-500/20">
                <Braces className="size-4 text-violet-500" /> Template <span className="font-mono font-normal text-violet-600 dark:text-violet-300">{mail.template.name}</span>
              </h3>
              <div className="p-3">
                {(() => {
                  try {
                    return <JsonView value={JSON.parse(mail.template.data)} />
                  } catch {
                    return <pre className="font-mono text-xs whitespace-pre-wrap">{mail.template.data || '(sem TemplateData)'}</pre>
                  }
                })()}
              </div>
            </section>
          )}

          {mail.files.length > 0 && (
            <section className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <Paperclip className="size-4" />
                {plural(mail.files.length, 'anexo', 'anexos')}
                <span className="font-normal text-zinc-400">· {formatBytes(mail.files.reduce((s, a) => s + a.size, 0))}</span>
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                {mail.files.map((a, i) => (
                  <AttachmentCard key={a.index} mailId={mail.id} file={a} index={i} onPreview={() => onPreview(i)} />
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  )
}
