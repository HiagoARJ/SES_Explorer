import { CircleAlert, CircleCheck, Info, Mail, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info' | 'mail'

export interface ToastAction {
  label: string
  run: () => void
}

interface Toast {
  id: number
  kind: Kind
  title: string
  message?: string
  action?: ToastAction
  leaving?: boolean
}

type ToastFn = (kind: Kind, title: string, message?: string, action?: ToastAction) => void

const Ctx = createContext<{ toast: ToastFn } | null>(null)
let seq = 0

const ICON = { success: CircleCheck, error: CircleAlert, info: Info, mail: Mail }
const COLOR = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-indigo-500', mail: 'text-sky-500' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  // Marca como saindo, espera a animação e só então remove
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 170)
  }, [])

  const toast = useCallback<ToastFn>(
    (kind, title, message, action) => {
      const id = ++seq
      setToasts((t) => [...t.slice(-3), { id, kind, title, message, action }])
      setTimeout(() => dismiss(id), action ? 7000 : kind === 'error' ? 8000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON[t.kind]
          return (
            <div
              key={t.id}
              role="status"
              className={`${t.leaving ? 'animate-toast-out' : 'animate-toast-in'} pointer-events-auto flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3.5 shadow-lg shadow-zinc-900/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${COLOR[t.kind]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
                {t.message && <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{t.message}</p>}
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.run()
                    dismiss(t.id)
                  }}
                  className="focus-ring -my-0.5 rounded-md px-2 py-0.5 text-[13px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast fora do ToastProvider')
  return c.toast
}
