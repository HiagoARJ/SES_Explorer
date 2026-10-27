# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build

# ---------- runtime ----------
# Node em vez de nginx: o servidor interpreta o MIME do SendRawEmail e entrega ao navegador
# só o índice das mensagens (os anexos ficam em memória e são servidos sob demanda).
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4568
ENV LOCALSTACK_URL=http://host.docker.internal:4566
ENV AWS_REGION=us-east-1
# Lidas/estrelas/marcadores: o compose monta ./data aqui, o mesmo arquivo do npm run dev
ENV DATA_DIR=/app/data
# Sem dependências de runtime: o servidor é TypeScript puro (type stripping do Node)
COPY package.json ./
COPY server ./server
# lógica das marcações compartilhada com a UI
COPY src/lib/marks.ts ./src/lib/marks.ts
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
EXPOSE 4568
USER node
CMD ["node", "server/index.ts"]
