import type { Flags, Label } from './types'

const PREFIX = 'sesx:'
/** Prefixo de quando o projeto se chamava SES Mail */
const OLD_PREFIX = 'sesmail:'

/** Move as preferências do prefixo antigo para o novo (uma vez, sem sobrescrever). */
function migratePrefix() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(OLD_PREFIX) || k === `${OLD_PREFIX}flags` || k === `${OLD_PREFIX}labels`) continue
      const nk = PREFIX + k.slice(OLD_PREFIX.length)
      if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k) ?? '')
      localStorage.removeItem(k)
    }
  } catch {
    // storage indisponível — ignorar
  }
}
migratePrefix()

/** Preferências deste navegador (tema, densidade, seções abertas…). Marcações ficam no servidor. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage indisponível (modo privado, bloqueado etc.) — ignorar
  }
}

const LOCAL_MARK_KEYS = ['sesmail.flags', `${OLD_PREFIX}flags`, `${OLD_PREFIX}labels`, 'sesmail.theme']

/**
 * Marcações que versões anteriores guardavam no navegador (v1: "sesmail.flags"; v2: "sesmail:flags"
 * e "sesmail:labels"). Devolve null se não houver nada para migrar para o servidor.
 */
export function takeLocalMarks(): { flags: Record<string, Flags>; labels: Label[] } | null {
  try {
    const parse = <T,>(k: string, fb: T): T => JSON.parse(localStorage.getItem(k) || 'null') ?? fb
    const flags = { ...parse<Record<string, Flags>>('sesmail.flags', {}), ...parse<Record<string, Flags>>(`${OLD_PREFIX}flags`, {}) }
    const labels = parse<Label[]>(`${OLD_PREFIX}labels`, [])
    return Object.keys(flags).length || labels.length ? { flags, labels } : null
  } catch {
    return null
  }
}

export function clearLocalMarks(): void {
  try {
    for (const k of LOCAL_MARK_KEYS) localStorage.removeItem(k)
  } catch {
    // ignorar
  }
}
