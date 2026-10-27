import { Check, Minus, Plus, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useFlags } from '../../hooks/useFlags'
import { routeHref } from '../../hooks/useHashRoute'
import { LABEL_COLORS, useLabels } from '../../hooks/useLabels'
import { useToast } from '../../hooks/useToast'
import { fold } from '../../lib/mail'
import type { Label } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input } from '../ui/Form'
import { Popover } from '../ui/Misc'

export const labelVars = (color: string) => ({ '--c': color }) as CSSProperties

/** Etiqueta colorida; com onRemove mostra um X, com link vira atalho para a pasta do marcador. */
export function LabelChip({ label, onRemove, link, className = '' }: { label: Label; onRemove?: () => void; link?: boolean; className?: string }) {
  const body = (
    <>
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="-mr-1 rounded p-px opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          aria-label={`Remover marcador ${label.name}`}
        >
          <X className="size-3" />
        </button>
      )}
    </>
  )
  const cls = `label-chip animate-pop-in inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] leading-5 font-medium ${className}`
  return link ? (
    <a href={routeHref({ kind: 'label', value: label.id })} onClick={(e) => e.stopPropagation()} className={`${cls} hover:brightness-95`} style={labelVars(label.color)}>
      {body}
    </a>
  ) : (
    <span className={cls} style={labelVars(label.color)}>
      {body}
    </span>
  )
}

/* ---------------- menu de aplicar ---------------- */

function MenuBody({ ids, close }: { ids: string[]; close: () => void }) {
  const { labels, create, findByName } = useLabels()
  const { flags, toggleLabel } = useFlags()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const shown = useMemo(() => labels.filter((l) => !q.trim() || fold(l.name).includes(fold(q.trim()))), [labels, q])
  const canCreate = q.trim().length > 0 && !findByName(q)
  const count = (id: string) => ids.filter((m) => flags[m]?.labels?.includes(id)).length

  const toggle = (l: Label) => toggleLabel(ids, l.id, count(l.id) < ids.length)
  const createAndApply = () => {
    const l = create(q)
    toggleLabel(ids, l.id, true)
    toast('success', `Marcador “${l.name}” criado`, ids.length > 1 ? `aplicado em ${ids.length} mensagens` : undefined)
    setQ('')
  }
  const rows = shown.length + (canCreate ? 1 : 0)

  return (
    <div className="w-full">
      <div className="px-1.5 pt-1 pb-1.5">
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
              setActive((a) => Math.min(a + 1, rows - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (active < shown.length) toggle(shown[active])
              else if (canCreate) createAndApply()
            } else if (e.key === 'Escape') close()
          }}
          placeholder="Buscar ou criar marcador"
          className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>
      <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
        Marcar {ids.length > 1 ? `${ids.length} mensagens` : 'como'}
      </p>
      <div className="max-h-64 overflow-y-auto">
        {shown.map((l, i) => {
          const n = count(l.id)
          const state = n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
          return (
            <button
              key={l.id}
              type="button"
              onMouseMove={() => setActive(i)}
              onClick={() => toggle(l)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-zinc-700 transition-colors dark:text-zinc-300 ${
                i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  state === 'none' ? 'border-zinc-300 dark:border-zinc-600' : 'border-transparent text-white'
                }`}
                style={state === 'none' ? undefined : { background: l.color }}
              >
                {state === 'all' && <Check className="animate-pop-in size-3" strokeWidth={3} />}
                {state === 'some' && <Minus className="size-3" strokeWidth={3} />}
              </span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
            </button>
          )
        })}
        {canCreate && (
          <button
            type="button"
            onMouseMove={() => setActive(shown.length)}
            onClick={createAndApply}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-indigo-600 dark:text-indigo-300 ${
              active === shown.length ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
            }`}
          >
            <Plus className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Criar “<b className="font-semibold">{q.trim()}</b>”
            </span>
          </button>
        )}
        {!labels.length && !q && <p className="px-2.5 py-2 text-xs text-zinc-500">Nenhum marcador ainda. Digite um nome para criar.</p>}
        {labels.length > 0 && !shown.length && !canCreate && <p className="px-2.5 py-2 text-xs text-zinc-500">Nada encontrado.</p>}
      </div>
    </div>
  )
}

/** Botão + menu para aplicar marcadores às mensagens `ids` (a tecla l abre). */
export function LabelMenu({ ids, size = 'sm' }: { ids: string[]; size?: 'xs' | 'sm' }) {
  return (
    <Popover
      align="left"
      width="w-64"
      trigger={({ open, toggle }) => (
        <IconButton icon={Tag} label="Marcadores (l)" size={size} active={open} onClick={toggle} disabled={!ids.length} data-label-trigger="" />
      )}
    >
      {(close) => <MenuBody ids={ids} close={close} />}
    </Popover>
  )
}

/* ---------------- criar / editar ---------------- */

export function LabelDialog({
  open,
  label,
  onClose,
  onDeleted,
}: {
  open: boolean
  /** Ausente = criar */
  label?: Label
  onClose: () => void
  onDeleted?: (id: string) => void
}) {
  const { labels, create, update, remove, nextColor, findByName } = useLabels()
  const { flags } = useFlags()
  const toast = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState(LABEL_COLORS[0])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(label?.name ?? '')
    setColor(label?.color ?? nextColor())
    setConfirmDelete(false)
  }, [open, label, nextColor])

  const clash = findByName(name)
  const error = !name.trim() ? null : clash && clash.id !== label?.id ? 'Já existe um marcador com esse nome' : null
  const ok = name.trim().length > 0 && !error
  const used = label ? Object.values(flags).filter((f) => f.labels?.includes(label.id)).length : 0

  const save = () => {
    if (!ok) return
    if (label) {
      update(label.id, { name, color })
      toast('success', 'Marcador atualizado')
    } else {
      const l = create(name, color)
      toast('success', `Marcador “${l.name}” criado`, 'Aplique pelo ícone de etiqueta ou com a tecla l.')
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      icon={Tag}
      title={label ? 'Editar marcador' : 'Novo marcador'}
      description={label ? undefined : `Organize os e-mails de teste. ${labels.length ? `Você tem ${labels.length}.` : ''}`}
      footer={
        <>
          {label && (
            <Button
              variant="danger-ghost"
              icon={Trash2}
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true)
                remove(label.id)
                toast('success', `Marcador “${label.name}” excluído`)
                onDeleted?.(label.id)
                onClose()
              }}
            >
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!ok}>
            {label ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Nome" error={error}>
          <Input ref={input} autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Cadastro, Faturamento, Bug #42" invalid={!!error} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Cor</span>
          <div className="flex flex-wrap gap-2">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={c === color}
                className={`focus-ring flex size-7 items-center justify-center rounded-full text-white transition-transform hover:scale-110 active:scale-95 ${
                  c === color ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''
                }`}
                style={{ background: c, ['--tw-ring-color' as string]: c }}
              >
                {c === color && <Check className="animate-pop-in size-3.5" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-950/50 dark:ring-zinc-800">
          Prévia:
          <LabelChip key={color} label={{ id: 'preview', name: name.trim() || 'Marcador', color }} />
        </div>
        {label && confirmDelete && (
          <p className="animate-fade-in text-xs text-rose-600 dark:text-rose-400">
            {used ? `Ele será removido de ${used} mensage${used > 1 ? 'ns' : 'm'}.` : 'Nenhuma mensagem usa este marcador.'} As mensagens não são apagadas.
          </p>
        )}
      </form>
    </Dialog>
  )
}
