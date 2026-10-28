#!/bin/sh
set -eu
# Never run DDL in an API replica. Only the migrate service has DDL credentials.
node /app/railway/wait-for-migrations.mjs
exec node /app/dist/main.js
