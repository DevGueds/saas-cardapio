#!/bin/sh
set -e

# Se MIGRATION_DATABASE_URL foi configurada, executa as migrações automaticamente antes de iniciar a API
if [ -n "$MIGRATION_DATABASE_URL" ]; then
  echo "=> Executando migrações do banco de dados (prisma migrate deploy)..."
  prisma migrate deploy
  echo "=> Migrações concluídas com sucesso."
fi

exec "$@"
