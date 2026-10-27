/**
 * Servidor de produção (Docker / npm start): serve o build do Vite (dist/) e a API /api/ses.
 * Node 22.18+ roda este arquivo .ts direto (type stripping) — sem dependências.
 *
 *   node server/index.ts         → http://localhost:4568
 *   node server/index.ts 8082    → porta alternativa
 *
 * Variáveis (ambiente ou .env): PORT, LOCALSTACK_URL, AWS_REGION, DATA_DIR.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInboxApi } from './inbox.ts'

try {
  process.loadEnvFile('.env') // não sobrescreve o que já veio do ambiente
} catch {
  // sem .env — usa os padrões
}

const PORT = Number(process.argv[2] || process.env.PORT || 4568)
const LOCALSTACK = (process.env.LOCALSTACK_URL || 'http://localhost:4566').replace(/\/+$/, '')
const REGION = process.env.AWS_REGION || 'us-east-1'
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
// Lidas/estrelas/marcadores. Padrão: data/ na pasta do projeto — a mesma que o npm run dev usa.
const DATA_DIR = resolve(process.env.DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)))

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

async function sendFile(res: ServerResponse, file: string, immutable: boolean) {
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}

async function serveStatic(pathname: string, res: ServerResponse) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([\\/]|\.\.)+/, '')
  const file = join(DIST, rel)
  if (file.startsWith(DIST) && !file.endsWith(sep)) {
    const s = await stat(file).catch(() => null)
    if (s?.isFile()) return sendFile(res, file, pathname.startsWith('/assets/'))
  }
  if (pathname.startsWith('/assets/')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('Não encontrado')
  }
  // SPA: qualquer outra rota cai no index.html
  const index = join(DIST, 'index.html')
  if (await stat(index).catch(() => null)) return sendFile(res, index, false)
  res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Build não encontrado. Rode "npm run build" antes de "npm start" (ou use "npm run dev").')
}

const api = createInboxApi({ localstackUrl: LOCALSTACK, region: REGION, dataDir: DATA_DIR })

createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  void api(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      return res.end()
    }
    serveStatic(pathname, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(String(err))
    })
  })
}).listen(PORT, () => {
  console.log(`\n  SES Explorer  →  http://localhost:${PORT}`)
  console.log(`  LocalStack    →  ${LOCALSTACK}/_aws/ses (${REGION})`)
  console.log(`  Marcações     →  ${join(DATA_DIR, 'state.json')}\n`)
})
