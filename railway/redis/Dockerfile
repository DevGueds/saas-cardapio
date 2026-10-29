# syntax=docker/dockerfile:1
FROM redis:8.2-alpine@sha256:b51665e66f00759be7c3152ad5ac3c66fb2f619c13ef62dea7cc1f9914524635
COPY railway/redis/start.sh /opt/cardapio-redis.sh
ENTRYPOINT ["/bin/sh", "/opt/cardapio-redis.sh"]
