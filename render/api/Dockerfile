# syntax=docker/dockerfile:1
# Render Docker context is the repository root. Railway remains independent.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY backend/package.json ./backend/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY backend ./backend
COPY packages ./packages
RUN pnpm -r rebuild && pnpm run postinstall && pnpm api:build

FROM build AS api-package
RUN pnpm --filter @cardapio/api deploy --prod --legacy --prefer-offline --network-concurrency=4 /opt/api

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Only the dedicated migration service receives a DDL credential.
RUN npm install --global prisma@7.10.0
COPY --from=api-package --chown=node:node /opt/api ./
COPY --from=build --chown=node:node /workspace/backend/prisma ./prisma
COPY --chown=node:node render/environment.mjs ./environment.mjs
COPY --chown=node:node render/api/*.mjs ./render/
COPY --chown=node:node railway/api/readiness.mjs ./render/readiness.mjs
USER node
EXPOSE 3001
CMD ["node", "/app/render/start.mjs"]
