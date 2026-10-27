# Contribuindo

Obrigado por ajudar. Este guia explica como preparar o ambiente, quais convenções o projeto segue e o que checar antes de abrir um PR.

## Ambiente

1. Instale o Node 22.18+ (recomendado: `fnm use 24`) e o Docker.
2. Suba um LocalStack com SES. Pode ser um que você já tenha ou o do compose:
   ```bash
   docker compose --profile localstack up -d localstack
   ```
3. Instale as dependências e rode:
   ```bash
   npm install
   npm run dev     # http://localhost:5175
   npm run seed    # e-mails de exemplo (opcional)
   ```

Se o seu LocalStack não estiver em `http://localhost:4566`, copie `.env.example` para `.env` e ajuste.

## Onde mexer

| Quero mudar… | Arquivo |
|---|---|
| como o MIME é interpretado | `server/mime.ts` |
| rotas da API e a conversa com o LocalStack | `server/inbox.ts` |
| formato das mensagens trocadas entre API e UI | `src/lib/types.ts` (compartilhado pelos dois lados) |
| lidas, estrelas e marcadores | `src/lib/marks.ts` (operações, usadas pelo servidor e pela UI) e `server/store.ts` (arquivo `data/state.json`) |
| lista, linha e seleção | `src/components/mail/Mailbox.tsx`, `src/components/mail/MailRow.tsx` |
| leitura da mensagem | `src/components/mail/MailReader.tsx`, `src/components/mail/MailFrame.tsx` |
| componentes base | `src/components/ui/` (são os mesmos do S3 e do DynamoDB Explorer: mantenha em sincronia) |
| animações | `src/index.css` (`@theme` e classes utilitárias) |

## Convenções

- **Português** na interface, nos comentários, nas mensagens de erro e nos commits.
- **Servidor sem dependências de runtime.** `server/` usa só módulos `node:*`. Os imports levam a extensão `.ts` e os tipos são importados com `import type`, porque o Node roda esses arquivos direto (type stripping).
- **Sintaxe apagável.** Nada de `enum`, `namespace` ou parameter properties no `server/`. O `tsconfig.node.json` já barra isso com `erasableSyntaxOnly`.
- **Segurança do HTML do e-mail.** O iframe do e-mail não pode ganhar `allow-scripts`. O HTML vem de fora e não deve executar JS.
- **Animações curtas** (até cerca de 400 ms) e sempre cobertas pelo bloco de `prefers-reduced-motion` do `index.css`.

## Antes de abrir o PR

```bash
npm run build                  # tsc -b (tipos estritos) + vite build
docker compose build           # a imagem continua compilando
```

Teste o fluxo afetado com mensagens reais: `npm run seed` cobre SendEmail, SendRawEmail com anexos e imagem `cid:`. Se mexer no parser, inclua um caso no seed.

## Commits e PRs

- Uma mudança por PR, com descrição do que e do porquê. O modelo do PR já traz a lista de checagem.
- Mudança visual? Anexe screenshots no claro e no escuro.
- Atualize o [CHANGELOG.md](CHANGELOG.md), na seção da próxima versão, e o README quando a mudança afetar o uso.
