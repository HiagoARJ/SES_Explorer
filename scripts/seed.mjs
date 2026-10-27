// Envia e-mails de exemplo pelo SES do LocalStack (texto, HTML, MIME com anexos e imagem cid:).
// Uso: npm run seed            → verifica o remetente e envia as mensagens
//      npm run seed -- --reset → limpa a caixa INTEIRA do LocalStack antes de enviar
// Sem dependências: fala com a API Query do SES via fetch (o LocalStack não confere a assinatura).
try {
  process.loadEnvFile?.('.env')
} catch {
  // sem .env — usa os padrões
}

const endpoint = (process.env.LOCALSTACK_URL || 'http://localhost:4566').replace(/\/+$/, '')
const region = process.env.AWS_REGION || 'us-east-1'
const reset = process.argv.includes('--reset')

const FROM = 'no-reply@exemplo.com.br'
const FROM_NAME = 'Loja Exemplo'

/* ---------------- SES ---------------- */

async function ses(action, params) {
  const body = new URLSearchParams({ Action: action, Version: '2010-12-01', ...params })
  const res = await fetch(endpoint + '/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      authorization: `AWS4-HMAC-SHA256 Credential=test/20260101/${region}/ses/aws4_request, SignedHeaders=host, Signature=0`,
    },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${action} → ${res.status}: ${text.slice(0, 300)}`)
  return text.match(/<MessageId>([^<]+)<\/MessageId>/)?.[1] ?? ''
}

/** Destination.ToAddresses.member.1=… */
const members = (prefix, list = []) => Object.fromEntries(list.map((v, i) => [`${prefix}.member.${i + 1}`, v]))

function sendEmail({ to, cc, subject, text, html }) {
  return ses('SendEmail', {
    Source: `${FROM_NAME} <${FROM}>`,
    ...members('Destination.ToAddresses', to),
    ...members('Destination.CcAddresses', cc),
    'Message.Subject.Data': subject,
    'Message.Subject.Charset': 'UTF-8',
    ...(text ? { 'Message.Body.Text.Data': text, 'Message.Body.Text.Charset': 'UTF-8' } : {}),
    ...(html ? { 'Message.Body.Html.Data': html, 'Message.Body.Html.Charset': 'UTF-8' } : {}),
  })
}

function sendRaw(mime, destinations) {
  return ses('SendRawEmail', {
    Source: FROM,
    ...members('Destinations', destinations),
    'RawMessage.Data': Buffer.from(mime, 'utf8').toString('base64'),
  })
}

/* ---------------- MIME ---------------- */

/** RFC 2047 para cabeçalhos com acentos */
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`)

function qp(str) {
  const lines = []
  for (const line of str.split('\n')) {
    let out = ''
    let len = 0
    for (const byte of Buffer.from(line, 'utf8')) {
      const ch = byte >= 33 && byte <= 126 && byte !== 61 ? String.fromCharCode(byte) : byte === 32 ? ' ' : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
      if (len + ch.length > 73) {
        out += '=\r\n'
        len = 0
      }
      out += ch
      len += ch.length
    }
    lines.push(out)
  }
  return lines.join('\r\n')
}

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/.{76}/g, '$&\r\n')

/** PDF mínimo válido com algumas linhas de texto */
function pdf(lines) {
  const content = `BT /F1 14 Tf 60 780 Td 18 TL ${lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) '`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="44" viewBox="0 0 180 44">
<rect width="180" height="44" rx="8" fill="#1a73e8"/>
<text x="90" y="29" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">Loja Exemplo</text>
</svg>`

function invoiceMime({ to, cc, number, customer, total }) {
  const mixed = `mixed-${number}`
  const related = `related-${number}`
  const alt = `alt-${number}`
  const text = `Olá, ${customer}!\n\nSegue em anexo a nota fiscal do pedido #${number}, no valor de R$ ${total}.\n\nObrigado pela compra,\n${FROM_NAME}`
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#202124">
<p><img src="cid:logo@exemplo" alt="${FROM_NAME}" width="180" height="44"></p>
<p>Olá, <b>${customer}</b>!</p>
<p>Segue em anexo a nota fiscal do pedido <b>#${number}</b>, no valor de <b>R$ ${total}</b>.</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#5f6368">Pedido</td><td>#${number}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#5f6368">Pagamento</td><td>Pix — confirmado</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#5f6368">Entrega</td><td>SEDEX, 3 a 5 dias úteis</td></tr>
</table>
<p style="color:#5f6368;font-size:12px">Este é um e-mail de exemplo gerado pelo <code>npm run seed</code>.</p>
</body></html>`
  const csv = `sku;descrição;qtd;preço\nSKU-0001;Fone Pro;1;349,90\nSKU-0007;Teclado Lite;2;${total}\n`
  const pdfName = `NF-${number}.pdf`
  const csvName = `itens-do-pedido-${number}-ção.csv`

  return [
    `From: ${word(FROM_NAME)} <${FROM}>`,
    `To: ${to.join(', ')}`,
    ...(cc?.length ? [`Cc: ${cc.join(', ')}`] : []),
    `Subject: ${word(`Nota fiscal do pedido #${number} — ${FROM_NAME}`)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/related; boundary="${related}"`,
    '',
    `--${related}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    qp(text),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    qp(html),
    `--${alt}--`,
    `--${related}`,
    'Content-Type: image/svg+xml; name="logo.svg"',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <logo@exemplo>',
    'Content-Disposition: inline; filename="logo.svg"',
    '',
    b64(LOGO),
    `--${related}--`,
    `--${mixed}`,
    `Content-Type: application/pdf; name="${pdfName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pdfName}"`,
    '',
    b64(pdf([`Nota fiscal - pedido #${number}`, '', `Cliente: ${customer}`, `Total: R$ ${total}`, '', 'Documento de exemplo (npm run seed).'])),
    `--${mixed}`,
    `Content-Type: text/csv; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(csvName)}`,
    '',
    b64(Buffer.from(csv, 'utf8')),
    `--${mixed}--`,
    '',
  ].join('\r\n')
}

/* ---------------- mensagens ---------------- */

const messages = [
  () =>
    sendEmail({
      to: ['ana.silva@exemplo.com.br'],
      subject: 'Bem-vinda à Loja Exemplo!',
      text: 'Olá, Ana!\n\nSua conta foi criada com sucesso. Use este e-mail para entrar.\n\nAté logo,\nLoja Exemplo',
    }),
  () =>
    sendEmail({
      to: ['bruno.souza@exemplo.com.br'],
      cc: ['financeiro@exemplo.com.br'],
      subject: 'Seu pedido #00042 foi enviado 🚚',
      text: 'Seu pedido #00042 saiu para entrega. Código de rastreio: BR123456789XX.',
      html: '<h2 style="font-family:Arial">Pedido #00042 a caminho 🚚</h2><p style="font-family:Arial">Código de rastreio: <b>BR123456789XX</b></p><p style="font-family:Arial"><a href="https://exemplo.com.br/pedidos/00042">Acompanhar pedido</a></p>',
    }),
  () =>
    sendEmail({
      to: ['carla.oliveira@exemplo.com.br'],
      subject: 'Código de verificação: 482 913',
      text: 'Seu código de verificação é 482913. Ele expira em 10 minutos.',
      html: '<div style="font-family:Arial;text-align:center"><p>Seu código de verificação é</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">482913</p><p style="color:#5f6368">Ele expira em 10 minutos.</p></div>',
    }),
  () =>
    sendRaw(invoiceMime({ to: ['diego.santos@exemplo.com.br'], number: '00057', customer: 'Diego Santos', total: '1.249,80' }), [
      'diego.santos@exemplo.com.br',
    ]),
  () =>
    sendRaw(
      invoiceMime({
        to: ['elisa.pereira@exemplo.com.br'],
        cc: ['contabilidade@exemplo.com.br'],
        number: '00061',
        customer: 'Elisa Pereira',
        total: '89,90',
      }),
      ['elisa.pereira@exemplo.com.br', 'contabilidade@exemplo.com.br'],
    ),
]

/* ---------------- execução ---------------- */

async function main() {
  console.log(`→ LocalStack: ${endpoint} (${region})`)
  try {
    await ses('VerifyEmailIdentity', { EmailAddress: FROM })
  } catch (err) {
    console.error(`✗ Não foi possível usar o SES do LocalStack em ${endpoint}. Rode "docker compose --profile localstack up -d" ou suba o seu LocalStack com SES.`)
    console.error(`  ${err.cause?.code || err.message}`)
    process.exit(1)
  }
  console.log(`  ✓ remetente ${FROM} verificado`)

  if (reset) {
    const res = await fetch(`${endpoint}/_aws/ses`, { method: 'DELETE' })
    console.log(res.ok ? '  - caixa do LocalStack limpa' : `  ! falha ao limpar a caixa (${res.status})`)
  }

  for (const send of messages) {
    const id = await send()
    console.log(`  + ${id}`)
  }
  console.log(`Pronto! ${messages.length} mensagens enviadas. Abra http://localhost:4568 (Docker) ou http://localhost:5175 (npm run dev)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
