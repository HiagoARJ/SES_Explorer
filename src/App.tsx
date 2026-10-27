import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CommandPalette, type PaletteActions } from './components/layout/CommandPalette'
import { ResizableAside, useSidebarLayout } from './components/layout/ResizableAside'
import { SettingsDialog } from './components/layout/SettingsDialog'
import { ShortcutsDialog } from './components/layout/ShortcutsDialog'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { ComposeDialog } from './components/mail/ComposeDialog'
import { Mailbox } from './components/mail/Mailbox'
import { ConfirmDialog, hasOpenLayer } from './components/ui/Dialog'
import { FlagsProvider, useFlags } from './hooks/useFlags'
import { useHashRoute, type Route } from './hooks/useHashRoute'
import { InboxProvider, useInbox } from './hooks/useInbox'
import { LabelsProvider } from './hooks/useLabels'
import { LabelDialog } from './components/mail/Labels'
import type { Label } from './lib/types'
import { SettingsProvider, useSettings } from './hooks/useSettings'
import { ToastProvider, useToast } from './hooks/useToast'
import { plural } from './lib/format'

const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

function Shell() {
  const { route, navigate } = useHashRoute()
  const inbox = useInbox()
  const { flags, set } = useFlags()
  const { settings, update } = useSettings()
  const toast = useToast()
  const layout = useSidebarLayout()
  const { toggle: toggleSidebar } = layout
  const search = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [labelDialog, setLabelDialog] = useState<{ open: boolean; label?: Label }>({ open: false })
  const createLabel = useCallback(() => setLabelDialog({ open: true }), [])
  const editLabel = useCallback((label: Label) => setLabelDialog({ open: true, label }), [])

  // ?q=termo na URL: dá para guardar o link de uma busca
  useEffect(() => {
    const url = new URL(location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    history.replaceState(null, '', url)
  }, [query])

  const openMail = useCallback((id: string) => navigate({ kind: 'inbox', message: id } satisfies Route), [navigate])

  // Mensagem nova: toast com atalho e, com a aba escondida, notificação do sistema
  useEffect(
    () =>
      inbox.onNewMail((arrived) => {
        const first = arrived[0]
        toast('mail', arrived.length === 1 ? 'Nova mensagem' : `${arrived.length} novas mensagens`, `${first.fromName} — ${first.subject}`, {
          label: 'Abrir',
          run: () => openMail(first.id),
        })
        if (settings.notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(arrived.length === 1 ? first.subject : `${arrived.length} novas mensagens no SES`, {
            body: arrived.length === 1 ? `${first.fromName} → ${first.to.join(', ')}` : arrived.map((m) => m.subject).join('\n'),
            icon: '/favicon.svg',
            tag: 'ses-explorer',
          })
          n.onclick = () => {
            window.focus()
            openMail(first.id)
            n.close()
          }
        }
      }),
    [inbox, toast, openMail, settings.notify],
  )

  // (3) SES Explorer · LocalStack
  const unread = inbox.mails.filter((m) => !flags[m.id]?.read).length
  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ''}SES Explorer · LocalStack`
  }, [unread])

  const markAllRead = useCallback(() => {
    const ids = inbox.mails.filter((m) => !flags[m.id]?.read).map((m) => m.id)
    if (!ids.length) return toast('info', 'Nenhuma mensagem não lida')
    set(ids, { read: true })
    toast('success', `${plural(ids.length, 'marcada', 'marcadas')} como lida${ids.length > 1 ? 's' : ''}`, undefined, {
      label: 'Desfazer',
      run: () => set(ids, { read: false }),
    })
  }, [inbox.mails, flags, set, toast])

  const clearInbox = async () => {
    setClearing(true)
    try {
      await inbox.clear()
      navigate({ kind: route.kind, value: route.value })
      toast('success', 'Caixa limpa no LocalStack')
      setConfirmClear(false)
    } catch (e) {
      toast('error', 'Não deu para limpar', (e as Error).message)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (typing(e.target)) return
      if ((e.ctrlKey || e.metaKey) && k === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || hasOpenLayer()) return
      if (e.key === '/') {
        e.preventDefault()
        search.current?.focus()
        search.current?.select()
      } else if (e.key === '?') setShortcutsOpen(true)
      else if (e.key === 'c') {
        e.preventDefault()
        setComposeOpen(true)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [toggleSidebar])

  const actions = useMemo<PaletteActions>(
    () => ({
      openMail,
      goto: (kind, value) => navigate({ kind, value }),
      createLabel,
      refresh: () => void inbox.refresh(),
      compose: () => setComposeOpen(true),
      markAllRead,
      clearInbox: () => setConfirmClear(true),
      toggleTheme: () => update({ theme: document.documentElement.classList.contains('dark') ? 'light' : 'dark' }),
      settings: () => setSettingsOpen(true),
      shortcuts: () => setShortcutsOpen(true),
    }),
    [openMail, navigate, inbox, markAllRead, update, createLabel],
  )

  const sidebarProps = {
    route,
    onCompose: () => {
      setMobileNav(false)
      setComposeOpen(true)
    },
    onOpenSettings: () => setSettingsOpen(true),
    onCreateLabel: () => {
      setMobileNav(false)
      createLabel()
    },
    onEditLabel: (l: Label) => {
      setMobileNav(false)
      editLabel(l)
    },
    onNavigate: () => setMobileNav(false),
  }

  return (
    <div className="flex h-full">
      <ResizableAside width={layout.width} collapsed={layout.collapsed} onChange={layout.setLayout}>
        <Sidebar {...sidebarProps} collapsed={layout.collapsed} onToggleCollapse={toggleSidebar} />
      </ResizableAside>

      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-zinc-950/40" onClick={() => setMobileNav(false)} />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-72 border-r border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <Sidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          ref={search}
          query={query}
          onQuery={setQuery}
          onMenu={() => setMobileNav(true)}
          onPalette={() => setPaletteOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
        />
        <main className="min-h-0 flex-1">
          <Mailbox
            route={route}
            navigate={navigate}
            query={query}
            onClearQuery={() => setQuery('')}
            onMarkAllRead={markAllRead}
            onClearInbox={() => setConfirmClear(true)}
            onCompose={() => setComposeOpen(true)}
            onEditLabel={editLabel}
          />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <LabelDialog open={labelDialog.open} label={labelDialog.label} onClose={() => setLabelDialog({ open: false })} />
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} onSent={(id) => id && settings.readingPane === 'right' && openMail(id)} />
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearInbox}
        busy={clearing}
        title="Limpar a caixa no LocalStack?"
        confirmLabel="Apagar todas"
      >
        Isso apaga <b>{plural(inbox.mails.length, 'mensagem', 'mensagens')}</b> do SES no LocalStack (<code className="font-mono text-xs">DELETE /_aws/ses</code>), para
        todas as aplicações que usam esse endpoint. Não tem volta.
      </ConfirmDialog>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <FlagsProvider>
          <LabelsProvider>
            <InboxProvider>
              <Shell />
            </InboxProvider>
          </LabelsProvider>
        </FlagsProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}
