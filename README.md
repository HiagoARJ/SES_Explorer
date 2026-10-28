# SES Explorer · LocalStack

> Projeto independente da comunidade, sem afiliação com a LocalStack GmbH. "LocalStack" é marca dos seus respectivos donos e aparece aqui só para indicar com o que a ferramenta funciona.

Caixa de entrada no estilo do Gmail para os e-mails que a sua aplicação envia pelo SES do LocalStack. O app lê `/_aws/ses` e mostra as mensagens numa interface de e-mail, em vez do JSON cru: HTML renderizado, anexos com pré-visualização, busca, atalhos e atualização em tempo real. É o projeto irmão do [DynamoDB Explorer](https://github.com/HiagoARJ/DynamoDB_Explorer) e do [S3 Explorer](https://github.com/HiagoARJ/S3_Explorer) e usa a mesma base visual.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · lucide-react · servidor Node sem dependências (`server/`)

## Como rodar

### Docker (recomendado)

```bash
docker compose up -d --build   # http://localhost:4568
```

A porta é **4568** porque a 8080 é do DynamoDB Explorer e a 8081 é do S3 Explorer. O container lê o LocalStack do host (`http://host.docker.internal:4566`). Para outro endereço, defina `DOCKER_LOCALSTACK_URL` antes do `up`.

Se você ainda não tiver um LocalStack, suba também o do compose. A imagem `localstack/localstack:latest` exige um token de licença:

```bash
# PowerShell: $env:LOCALSTACK_AUTH_TOKEN = "<seu token>"; $env:DOCKER_LOCALSTACK_URL = "http://localstack:4566"
docker compose --profile localstack up -d --build
```

> Vindo de uma versão anterior (quando o projeto se chamava SES Mail)? O container antigo se chamava `localstack-ses-mail` ou `ses-mail`. Remova-o antes para liberar a porta 4568: `docker rm -f localstack-ses-mail ses-mail`.

### Desenvolvimento

Requisitos: Node 22.18+ (com fnm: `fnm use 24`).

```bash
npm install
npm run dev          # http://localhost:5175
```

O Vite roda a mesma API do servidor de produção como middleware, então não há um segundo processo para subir. Ela lê `LOCALSTACK_URL` (padrão `http://localhost:4566`) e `AWS_REGION` (padrão `us-east-1`). Para mudar, crie um `.env` a partir do `.env.example`.

Para testar o build de produção sem Docker:

```bash
npm run build
npm start            # http://localhost:4568 (ou: node server/index.ts 8082)
```

### Dados de exemplo (opcional)

```bash
npm run seed              # verifica o remetente e envia 5 e-mails de exemplo
npm run seed -- --reset   # limpa a caixa INTEIRA do LocalStack antes de enviar
```

O seed manda 3 mensagens com `SendEmail` (só texto, texto + HTML, com cópia) e 2 com `SendRawEmail`. As duas do `SendRawEmail` têm assunto em RFC 2047, HTML em quoted-printable, logo embutido via `cid:`, um PDF e um CSV com nome acentuado em anexo. Também dá para enviar pela própria interface, em **Escrever** (tecla `c`).

## Por que um servidor Node, e não nginx como nos irmãos

O S3 e o DynamoDB Explorer usam nginx só como proxy. Aqui, o servidor também precisa interpretar as mensagens.

1. **CORS.** O LocalStack responde `403` para requisições de outra origem. A API faz a chamada ao `/_aws/ses` do lado do servidor.
2. **`SendRawEmail`.** Essas mensagens chegam como um MIME inteiro em `RawData` e **sem** `Subject`, `Destination` ou `Body`. Uma mensagem com PDFs tem fácil 1,5 MB. O [server/mime.ts](server/mime.ts) interpreta o MIME e o navegador recebe só o índice: alguns KB por mensagem, em vez de baixar tudo a cada atualização. O parser entende:
   - assunto em RFC 2047 e nomes de arquivo em RFC 2231;
   - multipart aninhado;
   - `quoted-printable` e `base64`;
   - anexos e imagens `cid:`.

   Os anexos ficam em memória e são servidos sob demanda.

O servidor é TypeScript sem nenhuma dependência de runtime. O Node 22.18+ roda os arquivos `.ts` direto (type stripping), e a imagem de produção leva só `server/` e `dist/`.

## API

| Rota | O que faz |
|---|---|
| `GET /api/ses` | lista normalizada (SendEmail, SendRawEmail e SendTemplatedEmail), sem os bytes dos anexos |
| `DELETE /api/ses` | limpa a caixa no LocalStack |
| `DELETE /api/ses/:id` | exclui uma mensagem |
| `POST /api/ses/send` | envia um e-mail de teste (`SendEmail`; verifica o remetente antes) |
| `GET /api/ses/identities` | identidades verificadas no SES (sugestões do remetente) |
| `GET /api/ses/:id/attachments/:i` | serve um anexo (também as imagens `cid:`). Com `?download=1`, força o download |
| `GET /api/ses/:id/source` | MIME original. Com `?download=1`, baixa como `.eml`, montado na hora para SendEmail |
| `GET /api/state` | lidas, estrelas e marcadores (`data/state.json`) |
| `POST /api/state` | aplica uma operação nas marcações (`set`, `toggleLabel`, `saveLabel`, `removeLabel`, `import`) |

### Onde ficam as marcações

O SES não guarda lidas, estrelas nem marcadores. O SES Explorer grava isso em **`data/state.json`**, na pasta do projeto. O mesmo arquivo serve aos dois modos:

- **`npm run dev`** e **`npm start`** usam `./data` direto.
- O **Docker** monta essa pasta (`./data:/app/data` no compose).

Por isso as marcações são as mesmas em `localhost:4568` e `localhost:5175`, em qualquer navegador, mesmo com os dois modos rodando ao mesmo tempo. Desligar o Docker ou o dev não apaga nada. Para outro local, defina `DATA_DIR`. A pasta `data/` está no `.gitignore`.

Marcações que versões anteriores guardavam no navegador são migradas para o arquivo na primeira abertura. Tema, densidade e outras preferências continuam por navegador.

Os **e-mails** ficam no LocalStack: o SES Explorer só lê. Eles sobrevivem a desligar o SES Explorer. Se sobrevivem a um reinício do LocalStack, depende da persistência configurada nele.

## Funcionalidades

**Caixa de entrada**
- **Painel de leitura ao lado da lista** em telas a partir de 1280 px, ou em tela cheia (configurável).
- **Layouts da lista:** em linha única no estilo do Gmail; em cartões (remetente, assunto e prévia) no painel dividido e no celular.
- **Agrupamento por dia:** Hoje, Ontem, dia da semana ou data, com o cabeçalho fixo ao rolar.
- **Pastas:** Caixa de entrada, Não lidas, Favoritos e Anexos.
- **Filtro por remetente e por destinatário** na barra lateral, com contagem de não lidas.
- **Marcadores** com nome e cor, como no Gmail:
  - criar pelo `+` da barra lateral ou direto no menu de aplicar;
  - aplicar pelo ícone de etiqueta, em lote na seleção ou com a tecla `l`. O menu busca e cria o marcador se ele não existir;
  - cada marcador vira uma pasta, e as etiquetas aparecem na lista e no leitor;
  - editar pelo lápis. Excluir pede confirmação e não apaga as mensagens.
- **Filtros rápidos combináveis** com contagem: Não lidas, Favoritos, Anexos e Hoje.
- **Busca sem acento** em assunto, endereços, corpo, nome de anexo e Message-Id, com destaque do termo. Por exemplo, "codigo" encontra "Código". `?q=termo` na URL abre já filtrado.
- **Seleção múltipla:** o avatar vira checkbox, e Shift + clique seleciona um intervalo. Em lote, dá para marcar como lida ou não lida, adicionar ou remover dos favoritos e excluir.
- **Ações rápidas** ao passar o mouse: marcar como lida ou não lida, baixar o `.eml` e excluir.
- **Chips de anexo** na própria linha: clicar abre a pré-visualização e a seta baixa.

**Leitura**
- **HTML do e-mail** num `iframe` isolado (`sandbox` sem `allow-scripts`), que nunca executa JS.
- **Prévia em largura de celular** (390 px, com moldura) para conferir e-mails responsivos.
- **Abas:**
  - HTML;
  - Texto;
  - **Links**: todos os links do e-mail, para abrir ou copiar. Útil para testar confirmação de cadastro e redefinição de senha;
  - **Original**: o MIME;
  - JSON.
- **Detalhes** expansíveis: De, Para, Cc, Cco, Responder para, região, tipo de envio, Message-Id e todos os cabeçalhos MIME.
- **Anexos em cartões** com miniatura das imagens.
- **Pré-visualização de anexos** sem sair da página: PDF, imagem, texto, CSV e JSON, com ← → entre os anexos.
- **SendTemplatedEmail:** o nome do template e o `TemplateData` aparecem formatados.
- **Ações da mensagem:** imprimir, baixar `.eml`, copiar o HTML ou o Message-Id e abrir em nova aba.

**Tempo real**
- Atualização automática configurável (2 s a 30 s, ou desligada).
- Quando chega e-mail novo, a linha aparece com destaque e um toast com **Abrir**. Com a aba em segundo plano, opcionalmente aparece uma **notificação do sistema**.
- Contador de não lidas no título da aba. A mensagem aberta não pisca nem recarrega a cada atualização.

**Geral**
- Lidas, não lidas, estrelas e marcadores ficam em `data/state.json`, compartilhado entre o Docker e o `npm run dev` (veja [Onde ficam as marcações](#onde-ficam-as-marcações)).
- "Marcar todas como lidas" tem **desfazer**.
- **Paleta de comandos** (Ctrl K) para buscar mensagens e ações.
- Tema claro, escuro ou do sistema.
- Densidade compacta ou confortável.
- **Menu lateral redimensionável:** arraste a borda (200–520 px) para mudar a largura. Ctrl B recolhe o menu para só ícones.
- **Animações:**
  - entrada das linhas em cascata;
  - linha que encolhe e some ao excluir;
  - avatar que gira e vira checkbox;
  - estrela que "pula";
  - contadores que pulsam ao mudar;
  - toasts e diálogos animados;
  - esqueleto com brilho no carregamento.

  Todas respeitam `prefers-reduced-motion`.

### Atalhos

| Tecla | Ação | Tecla | Ação |
|---|---|---|---|
| `j` / `↓` | próxima | `c` | novo e-mail de teste |
| `k` / `↑` | anterior | `r` | atualizar |
| `Enter` / `o` | abrir | `s` | favoritar |
| `Esc` | voltar, limpar seleção ou filtros | `u` | marcar como não lida |
| `/` | pesquisar | `x` | selecionar |
| `Ctrl K` | paleta de comandos | `#` / `Del` | excluir |
| `Ctrl B` | recolher o menu | `l` | marcadores |
| | | `?` | lista de atalhos |

### Fuso horário

O LocalStack grava `Timestamp` em UTC, sem sufixo de fuso. A UI trata o valor como UTC e converte para o horário local, por isso `20:48:46` aparece como `17:48` em Brasília.

## Estrutura

```
server/
  index.ts       servidor de produção: dist/ + API (node server/index.ts)
  inbox.ts       API /api/ses — LocalStack, cache, anexos, .eml, envio de teste
  mime.ts        parser MIME (RFC 2047/2231, multipart, QP/base64, cid:)
  store.ts       lidas/estrelas/marcadores em data/state.json (gravação atômica, relê se outro processo gravou)
src/
  lib/           tipos e operações de marcação (marks.ts) compartilhados com o servidor, API, filtros, datas e utilitários de e-mail
  hooks/         caixa de entrada (polling), lidas/estrelas, configurações, rota por hash e toasts
  components/
    layout/      barra lateral, barra superior, paleta de comandos, preferências e atalhos
    mail/        caixa (lista + leitura), linha, leitor, iframe do e-mail, anexos e envio de teste
    ui/          componentes base (botões, formulários, diálogos etc.), os mesmos dos projetos irmãos
scripts/seed.mjs e-mails de exemplo
```

Para contribuir, veja o [CONTRIBUTING.md](CONTRIBUTING.md). O histórico de versões está no [CHANGELOG.md](CHANGELOG.md).
