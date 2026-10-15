# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.23.0
COPY . .
RUN --mount=type=cache,id=cardapio-pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm api:build

FROM build AS api-package
RUN pnpm --filter @cardapio/api deploy --prod --legacy /opt/api

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-package --chown=node:node /opt/api ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM build AS web-build
ENV VITE_APP_MODE=api
ENV VITE_API_BASE_URL=/api/v1
RUN pnpm build:api

FROM caddy:2-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f AS web
# High ports do not require file capabilities; keep cap_drop ALL + no-new-privileges.
RUN setcap -r /usr/bin/caddy
ENV XDG_CONFIG_HOME=/tmp/config
ENV XDG_DATA_HOME=/tmp/data
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /workspace/dist /srv
USER 1000:1000
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
