import type { MarksOp } from './marks'
import type { ApiError, InboxResponse, MarksState, SendRequest } from './types'

const enc = encodeURIComponent

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { cache: 'no-store', ...init })
  const text = await r.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // corpo não-JSON (ex.: proxy fora do ar)
  }
  if (!r.ok) throw new Error((data as Partial<ApiError> | null)?.message || `HTTP ${r.status}`)
  return data as T
}

export const api = {
  list: (signal?: AbortSignal) => request<InboxResponse>('/api/ses', { signal }),
  remove: (id: string) => request<{ ok: boolean }>(`/api/ses/${enc(id)}`, { method: 'DELETE' }),
  clear: () => request<{ ok: boolean }>('/api/ses', { method: 'DELETE' }),
  identities: () => request<{ identities: string[] }>('/api/ses/identities'),
  marks: () => request<MarksState>('/api/state'),
  applyMarks: (op: MarksOp) =>
    request<MarksState>('/api/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(op) }),
  send: (body: SendRequest) =>
    request<{ messageId: string }>('/api/ses/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  source: async (id: string): Promise<string> => {
    const r = await fetch(sourceUrl(id), { cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  },
  text: async (url: string): Promise<string> => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  },
}

export const attachmentUrl = (id: string, index: number, download = false) =>
  `/api/ses/${enc(id)}/attachments/${index}${download ? '?download=1' : ''}`

export const sourceUrl = (id: string, download = false) => `/api/ses/${enc(id)}/source${download ? '?download=1' : ''}`
