import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createInboxApi } from './server/inbox.ts'

/**
 * /api/* → mesma API do servidor de produção (server/index.ts), rodando dentro do Vite.
 * É ela que fala com o LocalStack e interpreta o MIME; o navegador só recebe o índice leve.
 */
function sesApi(localstackUrl: string, region: string, dataDir: string): Plugin {
  const api = createInboxApi({ localstackUrl, region, dataDir })
  return {
    name: 'ses-api',
    configureServer: (s) => void s.middlewares.use(api),
    configurePreviewServer: (s) => void s.middlewares.use(api),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.LOCALSTACK_URL || 'http://localhost:4566'
  const region = env.AWS_REGION || 'us-east-1'
  // Mesmo arquivo de marcações que o Docker monta em /app/data
  const dataDir = resolve(env.DATA_DIR || 'data')

  return {
    plugins: [react(), tailwindcss(), sesApi(target, region, dataDir)],
    // 5173 e 5174 são do DynamoDB Explorer e do S3 Explorer
    server: { port: 5175 },
    preview: { port: 4175 },
  }
})
