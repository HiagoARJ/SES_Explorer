import { ChevronLeft, ChevronRight, Download, Eye, ExternalLink, FileQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, attachmentUrl } from '../../lib/api'
import { formatBytes, triggerDownload } from '../../lib/format'
import { FILE_STYLE, fileKind, previewMode } from '../../lib/mail'
import type { Attachment } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { EmptyState, Spinner } from '../ui/Misc'

export interface PreviewTarget {
  mailId: string
  files: Attachment[]
  index: number
}

/** Chip compacto da lista: abre a prévia; a seta ao lado baixa. */
export function AttachmentChip({ mailId, file, onPreview }: { mailId: string; file: Attachment; onPreview: () => void }) {
  const style = FILE_STYLE[fileKind(file)]
  return (
    <span className="group/chip inline-flex h-7 max-w-[220px] items-center overflow-hidden rounded-lg border border-zinc-200 bg-white text-xs shadow-xs transition-all hover:-translate-y-px hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900 dark:hover:border-zinc-600">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPreview()
        }}
        className="flex h-full min-w-0 items-center gap-1.5 pr-2 pl-1 text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        title={`Abrir ${file.name}`}
      >
        <span className={`rounded px-1 py-px text-[9px] font-bold tracking-wide ${style.cls}`}>{style.label}</span>
        <span className="truncate">{file.name}</span>
      </button>
      <a
        href={attachmentUrl(mailId, file.index, true)}
        download={file.name}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-6 shrink-0 items-center justify-center border-l border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700/80 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        title="Baixar"
        aria-label={`Baixar ${file.name}`}
      >
        <Download className="size-3.5" />
      </a>
    </span>
  )
}

/** Cartão da leitura, com miniatura para imagens. */
export function AttachmentCard({ mailId, file, onPreview, index }: { mailId: string; file: Attachment; onPreview: () => void; index: number }) {
  const kind = fileKind(file)
  const style = FILE_STYLE[kind]
  const Icon = style.icon
  return (
    <div
      className="animate-row-in group/card relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button type="button" onClick={onPreview} className="block w-full text-left" title={`Abrir ${file.name}`}>
        <div className={`flex h-24 items-center justify-center overflow-hidden ${kind === 'image' ? 'checkerboard' : style.cls}`}>
          {kind === 'image' ? (
            <img
              src={attachmentUrl(mailId, file.index)}
              alt=""
              loading="lazy"
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover/card:scale-105"
            />
          ) : (
            <Icon className="size-9 opacity-80 transition-transform duration-300 group-hover/card:scale-110" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <span className={`rounded px-1 py-px text-[9px] font-bold tracking-wide ${style.cls}`}>{style.label}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{file.name}</span>
          <span className="shrink-0 text-[11px] text-zinc-400">{formatBytes(file.size)}</span>
        </div>
      </button>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
        <IconButton icon={Eye} label="Pré-visualizar" size="xs" onClick={onPreview} className="bg-white/90 shadow-sm backdrop-blur dark:bg-zinc-900/90" />
        <IconButton
          icon={Download}
          label="Baixar"
          size="xs"
          onClick={() => triggerDownload(attachmentUrl(mailId, file.index, true), file.name)}
          className="bg-white/90 shadow-sm backdrop-blur dark:bg-zinc-900/90"
        />
      </div>
    </div>
  )
}

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ text?: string; error?: string }>({})
  useEffect(() => {
    let alive = true
    setState({})
    api
      .text(url)
      .then((text) => alive && setState({ text }))
      .catch((e: Error) => alive && setState({ error: e.message }))
    return () => {
      alive = false
    }
  }, [url])
  if (state.error) return <p className="p-6 text-sm text-rose-600">{state.error}</p>
  if (state.text === undefined)
    return (
      <div className="flex justify-center p-10">
        <Spinner className="size-5 text-zinc-400" />
      </div>
    )
  return (
    <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
      {state.text.length > 300_000 ? `${state.text.slice(0, 300_000)}\n\n… (truncado)` : state.text}
    </pre>
  )
}

export function AttachmentPreview({ target, onClose, onMove }: { target: PreviewTarget | null; onClose: () => void; onMove: (i: number) => void }) {
  const file = target?.files[target.index]
  const total = target?.files.length ?? 0

  useEffect(() => {
    if (!target || total < 2) return
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onMove((target.index - 1 + total) % total)
      if (e.key === 'ArrowRight') onMove((target.index + 1) % total)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [target, total, onMove])

  if (!target || !file) return null
  const url = attachmentUrl(target.mailId, file.index)
  const mode = previewMode(file)
  const style = FILE_STYLE[fileKind(file)]

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      icon={style.icon}
      title={<span className="block truncate">{file.name}</span>}
      description={`${file.type || 'tipo desconhecido'} · ${formatBytes(file.size)}${total > 1 ? ` · ${target.index + 1} de ${total}` : ''}`}
      footer={
        <>
          {total > 1 && (
            <div className="mr-auto flex gap-1">
              <IconButton icon={ChevronLeft} label="Anterior (←)" onClick={() => onMove((target.index - 1 + total) % total)} />
              <IconButton icon={ChevronRight} label="Próximo (→)" onClick={() => onMove((target.index + 1) % total)} />
            </div>
          )}
          <Button icon={ExternalLink} onClick={() => window.open(url, '_blank', 'noopener')}>
            Abrir em nova aba
          </Button>
          <Button variant="primary" icon={Download} onClick={() => triggerDownload(attachmentUrl(target.mailId, file.index, true), file.name)}>
            Baixar
          </Button>
        </>
      }
    >
      <div key={`${target.mailId}:${file.index}`} className="animate-fade-in -mx-5 -my-4">
        {mode === 'frame' ? (
          <iframe src={url} title={file.name} className="block h-[70vh] w-full bg-zinc-100 dark:bg-zinc-950" />
        ) : mode === 'image' ? (
          <div className="checkerboard flex max-h-[70vh] min-h-64 items-center justify-center overflow-auto p-4">
            <img src={url} alt={file.name} className="animate-pop-in max-w-full object-contain shadow-lg" />
          </div>
        ) : mode === 'text' ? (
          <TextPreview url={url} />
        ) : (
          <EmptyState icon={FileQuestion} title="Sem pré-visualização para este tipo">
            Baixe o arquivo para abrir no programa adequado.
          </EmptyState>
        )}
      </div>
    </Dialog>
  )
}
