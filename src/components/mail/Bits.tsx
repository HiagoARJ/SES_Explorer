import { Check, Star } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'
import { colorFor, initials, matchRanges } from '../../lib/mail'

export function Avatar({ name, email, className = 'size-9 text-sm' }: { name: string; email: string; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ${className}`}
      style={{ background: `linear-gradient(135deg, ${colorFor(email)}, color-mix(in oklab, ${colorFor(email)} 70%, black))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/** Avatar que gira e vira checkbox ao passar o mouse (ou quando já há seleção). */
export function SelectAvatar({
  name,
  email,
  selected,
  selecting,
  onToggle,
  className = 'size-9 text-sm',
}: {
  name: string
  email: string
  selected: boolean
  selecting: boolean
  onToggle: (e: MouseEvent) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle(e)
      }}
      aria-label={selected ? 'Desmarcar' : 'Selecionar'}
      aria-pressed={selected}
      className={`flip focus-ring relative shrink-0 rounded-full ${selected || selecting ? 'flipped' : ''} ${className}`}
    >
      <span className="flip-inner block">
        <span className="flip-face">
          <Avatar name={name} email={email} className="size-full" />
        </span>
        <span
          className={`flip-face flip-back flex items-center justify-center rounded-full transition-colors ${
            selected
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'border-2 border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'
          }`}
        >
          {selected && <Check className="animate-pop-in size-4" strokeWidth={3} />}
        </span>
      </span>
    </button>
  )
}

export function StarButton({ on, onToggle, className = '' }: { on: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={on ? 'Remover estrela' : 'Marcar com estrela'}
      aria-pressed={on}
      title={on ? 'Remover estrela (s)' : 'Marcar com estrela (s)'}
      className={`focus-ring flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-amber-500/10 ${className}`}
    >
      <Star
        key={on ? 'on' : 'off'}
        className={`size-4 ${on ? 'animate-star-pop fill-amber-400 text-amber-400' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'}`}
      />
    </button>
  )
}

/** Destaca o termo buscado (sem acento e sem diferenciar maiúsculas). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = query ? matchRanges(text, query) : []
  if (!ranges.length) return <>{text}</>
  const out = []
  let last = 0
  for (const [a, b] of ranges) {
    out.push(<Fragment key={`t${a}`}>{text.slice(last, a)}</Fragment>, <mark key={`m${a}`} className="hl">{text.slice(a, b)}</mark>)
    last = b
  }
  out.push(<Fragment key="end">{text.slice(last)}</Fragment>)
  return <>{out}</>
}

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g

export function JsonView({ value }: { value: unknown }) {
  const src = JSON.stringify(value, null, 2) ?? ''
  const out = []
  let last = 0
  for (const m of src.matchAll(TOKEN)) {
    const i = m.index ?? 0
    out.push(src.slice(last, i))
    const cls = m[1] ? (m[2] ? 'json-key' : 'json-str') : m[3] ? 'json-bool' : m[0] === 'null' ? 'json-null' : 'json-num'
    out.push(
      <span key={i} className={cls}>
        {m[1] ?? m[0]}
      </span>,
    )
    if (m[2]) out.push(m[2])
    last = i + m[0].length
  }
  out.push(src.slice(last))
  return (
    <pre className="overflow-x-auto rounded-xl bg-zinc-50 p-4 font-mono text-[12px] leading-relaxed ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
      {out}
    </pre>
  )
}
