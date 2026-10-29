#!/bin/sh
set -eu
if [ -z "${REDIS_PASSWORD:-}" ]; then echo '{"event":"redis_configuration_missing"}' >&2; exit 1; fi
# Upstream entrypoint repairs the volume owner and drops to the redis user.
exec /usr/local/bin/docker-entrypoint.sh redis-server --bind 0.0.0.0 :: \
  --requirepass "$REDIS_PASSWORD" --appendonly yes --maxmemory 128mb --maxmemory-policy noeviction
