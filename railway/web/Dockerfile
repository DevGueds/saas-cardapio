# syntax=docker/dockerfile:1
# Serviço "web" na Railway: frontend estático + proxy same-origin para a API privada.
# Contexto de build = raiz do repositório (RAILWAY_DOCKERFILE_PATH=railway/web/Dockerfile).
# Sem cache mounts: a Railway exige IDs prefixados pelo ID do serviço.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS web-build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY backend/package.json ./backend/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ENV VITE_APP_MODE=api
ENV VITE_API_BASE_URL=/api/v1
ARG PUBLIC_SITE_URL
ARG RAILWAY_PUBLIC_DOMAIN
ENV VITE_PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
RUN pnpm -r rebuild && pnpm run postinstall && pnpm build:api

FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f AS web
# Portas altas não exigem capabilities de arquivo.
RUN setcap -r /usr/bin/caddy
ENV XDG_CONFIG_HOME=/tmp/config
ENV XDG_DATA_HOME=/tmp/data
# Padrões sobrescritos pelas variáveis do serviço (veja .railway/railway.ts).
ENV PORT=8080
ENV API_PORT=3001
COPY railway/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /workspace/dist /srv
USER 1000:1000
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
