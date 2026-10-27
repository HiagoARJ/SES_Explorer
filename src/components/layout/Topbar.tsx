import { Command, Keyboard, Menu, Monitor, Moon, RefreshCw, Search, Sun, X } from 'lucide-react'
import { forwardRef } from 'react'
import { useInbox } from '../../hooks/useInbox'
import { useNow } from '../../hooks/useMediaQuery'
import { useSettings, type Theme } from '../../hooks/useSettings'
import { relativeTime } from '../../lib/format'
import { IconButton } from '../ui/Button'
import { Kbd } from '../ui/Misc'

const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const themeIcon = { system: Monitor, light: Sun, dark: Moon }
const themeLabel = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: escuro' }

export const Topbar = forwardRef<
  HTMLInputElement,
  { query: string; onQuery: (q: string) => void; onMenu: () => void; onPalette: () => void; onShortcuts: () => void }
>(function Topbar({ query, onQuery, onMenu, onPalette, onShortcuts }, ref) {
  const { settings, update } = useSettings()
  const { loading, refresh, updatedAt, status } = useInbox()
  useNow(5_000)
  const ThemeIcon = themeIcon[settings.theme]

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white/80 px-3 backdrop-blur-md sm:px-5 dark:border-zinc-800 dark:bg-zinc-950/80">
      <IconButton icon={Menu} label="Menu" className="lg:hidden" onClick={onMenu} />

      <label className="group focus-within:ring-indigo-500/20 relative flex h-10 max-w-2xl min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-zinc-100 px-3 ring-0 transition-all duration-200 focus-within:bg-white focus-within:shadow-md focus-within:ring-4 dark:bg-zinc-900 dark:focus-within:bg-zinc-900">
        <Search className="size-4 shrink-0 text-zinc-400 transition-colors group-focus-within:text-indigo-500" />
        <input
          ref={ref}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (query) onQuery('')
              else e.currentTarget.blur()
            }
          }}
          placeholder="Pesquisar e-mails"
          title="Busca em assunto, endereços, corpo, anexos e Message-Id"
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery('')}
            className="animate-pop-in rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Limpar busca"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <span className="hidden sm:block">
            <Kbd>/</Kbd>
          </span>
        )}
      </label>

      {/* no celular a busca ocupa todo o espaço livre */}
      <div className="flex-1 max-md:hidden" />

      <span className="hidden text-xs whitespace-nowrap text-zinc-400 md:inline" aria-live="polite">
        {status === 'offline' ? 'sem conexão' : updatedAt ? `atualizado ${relativeTime(new Date(updatedAt))}` : 'carregando…'}
      </span>
      <IconButton
        icon={RefreshCw}
        label="Atualizar (r)"
        onClick={() => refresh()}
        className={loading ? '[&>svg]:animate-spin' : 'active:[&>svg]:animate-spin-once'}
      />
      <button
        onClick={onPalette}
        className="focus-ring hidden h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600 xl:flex dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
      >
        <Command className="size-3.5" />
        <span>Comandos</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </button>
      <IconButton icon={Command} label="Comandos (Ctrl K)" className="max-sm:hidden xl:hidden" onClick={onPalette} />
      <IconButton icon={Keyboard} label="Atalhos (?)" className="max-sm:hidden" onClick={onShortcuts} />
      <IconButton icon={ThemeIcon} label={themeLabel[settings.theme]} onClick={() => update({ theme: nextTheme[settings.theme] })} />

      {/* barra de progresso fina durante carregamentos visíveis */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
        <div className="animate-progress h-full w-1/3 rounded-full bg-linear-to-r from-transparent via-indigo-500 to-transparent" />
      </div>
    </header>
  )
})
