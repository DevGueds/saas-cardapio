# syntax=docker/dockerfile:1
FROM postgres:18.6-alpine@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5
COPY --chmod=755 railway/postgres/init.sh /docker-entrypoint-initdb.d/10-cardapio.sh
CMD ["postgres", "-c", "max_connections=100", "-c", "shared_buffers=128MB", "-c", "timezone=UTC", "-c", "log_statement=none", "-c", "log_min_error_statement=panic", "-c", "log_min_messages=fatal", "-c", "log_error_verbosity=terse"]
