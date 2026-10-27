# Changelog

As mudanças relevantes de cada versão ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- **Marcadores**:
  - criar, editar (nome e cor) e excluir;
  - aplicar na mensagem aberta, em lote ou com a tecla `l`, com criação direto no menu;
  - uma pasta por marcador na barra lateral e etiquetas coloridas na lista e no leitor;
  - atalhos na paleta de comandos.
- Rotas `GET` e `POST /api/state` para as marcações.

### Alterado
- **O projeto foi renomeado de SES Mail para SES Explorer**, como os irmãos S3 Explorer e DynamoDB Explorer. O pacote e a imagem passam a se chamar `localstack-ses-explorer`, e o container `ses-explorer`. As preferências salvas no navegador são migradas.
- **Lidas, estrelas e marcadores saem do navegador e vão para `data/state.json`.** O mesmo arquivo serve ao `npm run dev` e ao Docker, que monta `./data:/app/data`. Assim as marcações são iguais em qualquer endereço e navegador. O que estava no `localStorage` é migrado na primeira abertura.
- Na lista em linha única, o assunto e os anexos ficam alinhados, e as colunas de remetente e destinatário acompanham o maior nome visível.
- No celular, os filtros rápidos descem para uma segunda linha rolável, e a busca ocupa toda a barra superior.
- O botão de envio passou a se chamar "Escrever".

## [2.0.0] - 2026-10-27

Reescrita na mesma stack do S3 Explorer e do DynamoDB Explorer: Vite, React 19, TypeScript e Tailwind CSS v4.

### Adicionado
- Painel de leitura ao lado da lista em telas largas, ou em tela cheia (configurável).
- Layout em cartões no painel dividido e no celular.
- Filtro por destinatário, além do filtro por remetente, e pasta "Com anexos".
- Seleção múltipla, com o avatar que vira checkbox e Shift + clique para selecionar um intervalo, e ações em lote.
- Exclusão de mensagens individuais (`DELETE /api/ses/:id`).
- Envio de e-mail de teste pela interface (`POST /api/ses/send`), com sugestão de remetentes verificados.
- Pré-visualização de anexos (PDF, imagem, texto, CSV e JSON) sem sair da página.
- Prévia do HTML em largura de celular.
- Novas abas no leitor: **Links**, com os links do e-mail para abrir ou copiar, e **Original**, com o MIME.
- Lista completa de cabeçalhos MIME nos detalhes, e o campo "Responder para".
- Suporte a SendTemplatedEmail: nome do template e `TemplateData`.
- Paleta de comandos (Ctrl K), diálogo de atalhos (`?`) e preferências.
- Notificação do sistema para e-mails novos com a aba em segundo plano (opcional).
- Intervalo da atualização automática configurável.
- Busca sem acento e com várias palavras.
- Animações na lista, no leitor, nos contadores, nos toasts e no carregamento, todas respeitando `prefers-reduced-motion`.
- Menu lateral redimensionável e recolhível (Ctrl B).

### Alterado
- O servidor foi reescrito em TypeScript (`server/`), ainda sem dependências de runtime. Em desenvolvimento, ele roda dentro do Vite.
- O `.eml` de mensagens enviadas com SendEmail passou a ser montado no servidor.
- No SendRawEmail, o remetente mostra o nome de exibição do cabeçalho `From`.

### Corrigido
- A prévia da lista não mostra mais o CSS dos blocos `<style>` de e-mails HTML.
- Endereços com vírgula no nome (`"Silva, Ana" <ana@x>`) não são mais quebrados em dois.
- Partes `8bit` com texto já decodificado não corrompem mais os acentos.

## 1.0.0 - 2026-10-27 (interna, antes do primeiro push)

### Adicionado
- Primeira versão: `index.html` único e `server.js` sem dependências.
- Lista agrupada por dia, leitura em `iframe` isolado, anexos, busca, filtros rápidos e atalhos de teclado.
- Script `npm run seed`, Docker e docker-compose.

### Corrigido
- Nomes de anexo em RFC 2231 com acento (`filename*=UTF-8''…`).
- O servidor não serve mais arquivos da pasta além da interface.

[2.0.0]: ../../releases/tag/v2.0.0
