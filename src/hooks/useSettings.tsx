import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readJSON, writeJSON } from '../lib/storage'

export type Theme = 'system' | 'light' | 'dark'
export type Density = 'compact' | 'comfortable'
export type ReadingPane = 'right' | 'off'
export type PreviewWidth = 'desktop' | 'mobile'

export interface Settings {
  theme: Theme
  density: Density
  /** Painel de leitura ao lado da lista (em telas largas) ou em tela cheia. */
  readingPane: ReadingPane
  /** Intervalo da atualização automática em ms (0 = desligada). */
  refreshMs: number
  /** Notificação do sistema quando chega e-mail com a aba em segundo plano. */
  notify: boolean
  markReadOnOpen: boolean
  /** Largura da prévia do HTML: desktop ou celular. */
  previewWidth: PreviewWidth
  /** Último remetente usado no e-mail de teste. */
  lastFrom: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  density: 'comfortable',
  readingPane: 'right',
  refreshMs: 5000,
  notify: false,
  markReadOnOpen: true,
  previewWidth: 'desktop',
  lastFrom: 'Teste <no-reply@exemplo.com.br>',
}

interface SettingsCtx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  isDark: boolean
}

const Ctx = createContext<SettingsCtx | null>(null)

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>('settings', {}) }))
  const systemDark = useSystemDark()
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      writeJSON('settings', next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ settings, update, isDark }), [settings, update, isDark])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSettings fora do SettingsProvider')
  return c
}
