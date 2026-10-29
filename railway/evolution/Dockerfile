# syntax=docker/dockerfile:1
FROM evoapicloud/evolution-api:v2.3.7@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339
# The privacy gate must be baked into the image: Railway cannot mount host files.
COPY docker/provider-log-gate.cjs /opt/cardapio/provider-log-gate.cjs
ENTRYPOINT ["node", "/opt/cardapio/provider-log-gate.cjs", "/bin/bash", "-c", ". ./Docker/scripts/deploy_database.sh && npm run start:prod"]
