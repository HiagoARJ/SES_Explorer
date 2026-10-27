import { Code, PenSquare, Send, Type } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useInbox } from '../../hooks/useInbox'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input } from '../ui/Form'
import { Segmented } from '../ui/Misc'

const SAMPLE_HTML = `<h2 style="font-family:Arial">Olá! 👋</h2>
<p style="font-family:Arial">Este é um e-mail de teste enviado pelo <b>SES Explorer</b>.</p>
<p style="font-family:Arial"><a href="https://exemplo.com.br/confirmar?token=abc123">Confirmar e-mail</a></p>`

const list = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const valid = (s: string) => EMAIL.test(s.match(/<([^>]+)>/)?.[1] ?? s)

export function ComposeDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (id: string) => void }) {
  const { settings, update } = useSettings()
  const { refresh } = useInbox()
  const toast = useToast()
  const [from, setFrom] = useState(settings.lastFrom)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [format, setFormat] = useState<'text' | 'html'>('html')
  const [body, setBody] = useState(SAMPLE_HTML)
  const [identities, setIdentities] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setFrom(settings.lastFrom)
    setTouched(false)
    api
      .identities()
      .then((r) => setIdentities(r.identities))
      .catch(() => setIdentities([]))
  }, [open, settings.lastFrom])

  const toList = list(to)
  const ccList = list(cc)
  const errors = {
    from: !valid(from) ? 'Remetente inválido' : null,
    to: !toList.length ? 'Informe ao menos um destinatário' : toList.some((x) => !valid(x)) ? 'Há um endereço inválido' : null,
    cc: ccList.some((x) => !valid(x)) ? 'Há um endereço inválido' : null,
  }
  const ok = !errors.from && !errors.to && !errors.cc && body.trim().length > 0

  const send = async () => {
    setTouched(true)
    if (!ok) return
    setBusy(true)
    try {
      const { messageId } = await api.send({
        from,
        to: toList,
        cc: ccList,
        subject: subject || '(sem assunto)',
        ...(format === 'html' ? { html: body } : { text: body }),
      })
      update({ lastFrom: from })
      toast('success', 'E-mail enviado pelo SES', `para ${toList.join(', ')}`)
      onClose()
      await refresh(true)
      onSent(messageId)
    } catch (e) {
      toast('error', 'Não deu para enviar', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      icon={PenSquare}
      title="Novo e-mail de teste"
      description="Envia de verdade pelo SES do LocalStack (SendEmail). O remetente é verificado automaticamente."
      footer={
        <>
          <span className="mr-auto hidden text-xs text-zinc-400 sm:inline">Ctrl + Enter envia</span>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Send} onClick={send} loading={busy} disabled={touched && !ok}>
            Enviar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void send()
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="De" error={touched ? errors.from : null} hint="Ex.: Loja <no-reply@loja.com>">
            <Input value={from} onChange={(e) => setFrom(e.target.value)} list="ses-identities" invalid={touched && !!errors.from} />
            <datalist id="ses-identities">
              {identities.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </Field>
          <Field label="Assunto">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="(sem assunto)" />
          </Field>
          <Field label="Para" error={touched ? errors.to : null} hint="Separe vários com vírgula">
            <Input autoFocus value={to} onChange={(e) => setTo(e.target.value)} placeholder="ana@exemplo.com.br" invalid={touched && !!errors.to} />
          </Field>
          <Field label="Cc" error={touched ? errors.cc : null}>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} invalid={touched && !!errors.cc} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Corpo</span>
            <Segmented
              size="xs"
              value={format}
              onChange={(f) => {
                setFormat(f)
                if (f === 'text' && body === SAMPLE_HTML) setBody('Olá! Este é um e-mail de teste enviado pelo SES Explorer.')
                if (f === 'html' && !body.trim()) setBody(SAMPLE_HTML)
              }}
              options={[
                { value: 'html', label: 'HTML', icon: Code },
                { value: 'text', label: 'Texto', icon: Type },
              ]}
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            spellCheck={format === 'text'}
            className={`w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-xs transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 ${
              format === 'html' ? 'font-mono text-[12.5px]' : ''
            }`}
          />
        </div>
      </form>
    </Dialog>
  )
}
