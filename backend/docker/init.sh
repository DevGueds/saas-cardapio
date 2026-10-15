#!/bin/sh
set -eu
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot <<'SQL'
CREATE DATABASE IF NOT EXISTS cardapio_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
REVOKE ALL PRIVILEGES ON cardapio.* FROM 'cardapio'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cardapio.* TO 'cardapio'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cardapio_test.* TO 'cardapio'@'%';
SQL
