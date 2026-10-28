import { Keyboard } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Kbd } from '../ui/Misc'

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: 'Navegação',
    keys: [
      [['j', '↓'], 'Próxima mensagem'],
      [['k', '↑'], 'Mensagem anterior'],
      [['Enter', 'o'], 'Abrir mensagem'],
      [['Esc'], 'Voltar, limpar seleção ou filtros'],
      [['/'], 'Pesquisar'],
      [['Ctrl', 'K'], 'Paleta de comandos'],
      [['Ctrl', 'B'], 'Recolher/expandir o menu'],
    ],
  },
  {
    title: 'Ações',
    keys: [
      [['c'], 'Escrever e-mail de teste'],
      [['r'], 'Atualizar'],
      [['s'], 'Favoritar'],
      [['u'], 'Marcar como não lida'],
      [['l'], 'Marcadores'],
      [['x'], 'Selecionar'],
      [['Shift', 'clique'], 'Selecionar intervalo'],
      [['#', 'Del'], 'Excluir'],
      [['?'], 'Esta lista'],
    ],
  },
]

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Atalhos de teclado" icon={Keyboard} size="lg">
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.keys.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
