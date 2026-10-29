# syntax=docker/dockerfile:1
# Serviço "api" na Railway: API privada NestJS/Fastify.
# Contexto de build = raiz do repositório (RAILWAY_DOCKERFILE_PATH=railway/api/Dockerfile).
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY backend/package.json ./backend/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
# Railway requires service-specific literal IDs for cache mounts. A reusable
# template cannot embed those IDs; use ordinary Docker layer caching instead.
RUN pnpm install --frozen-lockfile --ignore-scripts
# Only backend/workspace sources enter this stage; editing deploy scripts or docs
# must not rebuild Prisma, native modules and the production dependency bundle.
COPY backend ./backend
COPY packages ./packages
RUN pnpm -r rebuild && pnpm run postinstall && pnpm api:build

FROM build AS api-package
# Prefer cached metadata; limit registry bursts when legacy deploy needs a lookup.
RUN pnpm --filter @cardapio/api deploy --prod --legacy --prefer-offline --network-concurrency=4 /opt/api

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS api
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global prisma@7.10.0
COPY --from=api-package --chown=node:node /opt/api ./
COPY --from=build --chown=node:node /workspace/backend/prisma ./prisma
COPY --chown=node:node railway/api/certs ./certs
COPY --chown=node:node railway/api/*.mjs ./railway/
COPY --chown=node:node railway/api/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/logs && chown -R node:node /app/logs && chmod +x /app/entrypoint.sh
USER node
EXPOSE 3001
CMD ["/app/entrypoint.sh"]
