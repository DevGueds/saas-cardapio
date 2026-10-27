#!/bin/sh
set -eu

# psql variables quote passwords as SQL literals; never interpolate them into shell SQL.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=app_password="$POSTGRES_APP_PASSWORD" \
  --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" <<'SQL'
CREATE ROLE cardapio LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
CREATE ROLE cardapio_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'migration_password';
CREATE DATABASE cardapio OWNER cardapio_migrator ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE cardapio_test OWNER cardapio_migrator ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE cardapio, cardapio_test FROM PUBLIC;
GRANT CONNECT ON DATABASE cardapio, cardapio_test TO cardapio;
SQL

for database in cardapio cardapio_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cardapio;
ALTER DEFAULT PRIVILEGES FOR ROLE cardapio_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cardapio;
ALTER DEFAULT PRIVILEGES FOR ROLE cardapio_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO cardapio;
SQL
done
