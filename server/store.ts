/**
 * Marcações (lidas, estrelas, marcadores) em data/state.json.
 *
 * O mesmo arquivo serve ao npm run dev (pasta do projeto) e ao Docker (volume ./data:/app/data),
 * então os dois modos — e todos os navegadores — veem as mesmas marcações. Antes de cada leitura
 * ou alteração o arquivo é relido se outro processo gravou nele; a gravação é atômica (tmp + rename).
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMarks, EMPTY_MARKS, pruneMarks, type MarksOp } from '../src/lib/marks.ts'
import type { MarksState } from '../src/lib/types.ts'

export function createStore(dir: string) {
  const file = join(dir, 'state.json')
  let state: MarksState = EMPTY_MARKS
  let mtime = -1

  function load() {
    try {
      const s = statSync(file)
      if (s.mtimeMs === mtime) return
      const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<MarksState>
      state = { rev: Number(data.rev) || 0, flags: data.flags ?? {}, labels: data.labels ?? [] }
      mtime = s.mtimeMs
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'ENOENT') console.warn(`[state] não deu para ler ${file}: ${(err as Error).message}`)
    }
  }

  function save(next: MarksState) {
    state = { ...next, rev: state.rev + 1 }
    mkdirSync(dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(state, null, 2))
    renameSync(tmp, file)
    mtime = statSync(file).mtimeMs
  }

  load()

  return {
    file,
    get(): MarksState {
      load()
      return state
    },
    apply(op: MarksOp): MarksState {
      load()
      save(applyMarks(state, op))
      return state
    },
    prune(alive: Set<string>) {
      load()
      const next = pruneMarks(state, alive)
      if (next) save(next)
    },
  }
}
