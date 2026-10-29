#!/bin/sh
set -eu
# Runs only on a new volume; does not create test databases in production.
psql -q -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=app_password="$POSTGRES_APP_PASSWORD" \
  --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" <<'SQL'
CREATE ROLE cardapio LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
CREATE ROLE cardapio_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'migration_password';
CREATE DATABASE cardapio OWNER cardapio_migrator ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE cardapio FROM PUBLIC;
GRANT CONNECT ON DATABASE cardapio TO cardapio;
SQL
psql -q -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname cardapio <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cardapio;
ALTER DEFAULT PRIVILEGES FOR ROLE cardapio_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cardapio;
ALTER DEFAULT PRIVILEGES FOR ROLE cardapio_migrator IN SCHEMA public GRANT USAGE ON TYPES TO cardapio;
SQL
