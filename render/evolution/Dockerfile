# syntax=docker/dockerfile:1
FROM evoapicloud/evolution-api:v2.3.7@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339
COPY docker/provider-log-gate.cjs /opt/cardapio/provider-log-gate.cjs
COPY render/environment.mjs /opt/cardapio/render/environment.mjs
COPY render/evolution/start.mjs /opt/cardapio/render/evolution/start.mjs
ENTRYPOINT ["node", "/opt/cardapio/render/evolution/start.mjs"]
