/* Tipos compartilhados entre a API (server/) e a interface (src/). Só tipos: nada aqui vai para o runtime do servidor. */

export interface Attachment {
  index: number
  name: string
  type: string
  size: number
  /** Content-Disposition: inline */
  inline: boolean
  /** Content-ID (sem < >), usado pelas imagens cid: */
  cid: string
}

export interface MailHeader {
  name: string
  value: string
}

/** Mensagem normalizada pela API (SendEmail, SendRawEmail e SendTemplatedEmail). */
export interface MailMessage {
  id: string
  region: string
  source: string
  to: string[]
  cc: string[]
  bcc: string[]
  replyTo: string[]
  subject: string
  text: string
  html: string
  /** Como o LocalStack grava: UTC, sem sufixo de fuso. */
  timestamp: string
  /** true = SendRawEmail (MIME completo) */
  raw: boolean
  /** Tamanho do original em bytes */
  size: number
  attachments: Attachment[]
  /** Cabeçalhos de topo do MIME (só SendRawEmail) */
  headers: MailHeader[]
  template?: { name: string; data: string }
}

export interface InboxResponse {
  endpoint: string
  region: string
  messages: MailMessage[]
  /** Marcações salvas no servidor (vêm junto para manter as abas sincronizadas) */
  state: MarksState
}

export interface ApiError {
  error: string
  message: string
}

export interface SendRequest {
  from: string
  to: string[]
  cc: string[]
  subject: string
  text?: string
  html?: string
}

/** Mensagem pronta para a UI: datas e campos de busca já calculados. */
export interface Mail extends MailMessage {
  ts: Date
  fromName: string
  fromEmail: string
  snippet: string
  /** Texto de busca já sem acentos e em minúsculas */
  haystack: string
  /** Anexos que aparecem como arquivo (sem as imagens embutidas via cid:) */
  files: Attachment[]
}

export interface Flags {
  read?: boolean
  starred?: boolean
  /** ids dos marcadores aplicados */
  labels?: string[]
}

/** Marcador criado pelo usuário (o SES não tem isso; fica em data/state.json). */
export interface Label {
  id: string
  name: string
  color: string
}

/** Conteúdo de data/state.json — o mesmo para Docker e npm run dev. */
export interface MarksState {
  /** Sobe a cada gravação; a UI descarta estados mais antigos que o que já tem */
  rev: number
  flags: Record<string, Flags>
  labels: Label[]
}
