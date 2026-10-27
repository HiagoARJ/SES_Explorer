import { Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettings, type Settings as S } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Checkbox, Field, Select } from '../ui/Form'
import { Segmented } from '../ui/Misc'

const INTERVALS = [
  { value: 0, label: 'Desligada' },
  { value: 2000, label: 'A cada 2 s' },
  { value: 5000, label: 'A cada 5 s' },
  { value: 10_000, label: 'A cada 10 s' },
  { value: 30_000, label: 'A cada 30 s' },
]

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings()
  const toast = useToast()
  const [draft, setDraft] = useState<S>(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  const set = (patch: Partial<S>) => setDraft((d) => ({ ...d, ...patch }))

  const setNotify = async (on: boolean) => {
    if (!on) return set({ notify: false })
    if (!('Notification' in window)) return toast('error', 'Este navegador não suporta notificações')
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (perm === 'granted') set({ notify: true })
    else toast('error', 'Notificações bloqueadas', 'Libere nas permissões do site no navegador.')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preferências"
      description="Aparência e comportamento da caixa de entrada. Fica salvo neste navegador."
      icon={Settings}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => {
              update(draft)
              onClose()
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tema">
          <Segmented
            value={draft.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </Field>
        <Field label="Densidade da lista">
          <Segmented
            value={draft.density}
            onChange={(density) => set({ density })}
            options={[
              { value: 'compact', label: 'Compacta' },
              { value: 'comfortable', label: 'Confortável' },
            ]}
          />
        </Field>
        <Field label="Painel de leitura" hint="Ao lado da lista em telas a partir de 1280 px.">
          <Segmented
            value={draft.readingPane}
            onChange={(readingPane) => set({ readingPane })}
            options={[
              { value: 'right', label: 'À direita' },
              { value: 'off', label: 'Tela cheia' },
            ]}
          />
        </Field>
        <Field label="Atualização automática">
          <Select value={draft.refreshMs} onChange={(e) => set({ refreshMs: Number(e.target.value) })}>
            {INTERVALS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <Checkbox
            checked={draft.markReadOnOpen}
            onChange={(markReadOnOpen) => set({ markReadOnOpen })}
            label="Marcar como lida ao abrir a mensagem"
          />
          <Checkbox
            checked={draft.notify}
            onChange={(v) => void setNotify(v)}
            label={
              <span>
                Notificação do sistema quando chegar e-mail com a aba em segundo plano
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">A atualização automática continua mesmo com a aba escondida.</span>
              </span>
            }
          />
        </div>
      </div>
    </Dialog>
  )
}
