import { test } from "node:test"
import assert from "node:assert/strict"
import { postgresPoolConfig } from "../../src/shared/infrastructure/postgres-config.js"
import { retryableTransaction } from "../../src/shared/infrastructure/database.js"
import { Prisma } from "../../src/generated/prisma/client.js"
import { migrationConnection } from "../../prisma/connection.js"

const database = new URL("postgresql://runtime:test-only@127.0.0.1:5433/cardapio_test")
test("PostgreSQL has bounded pooling, query deadlines, UTC and verified TLS", () => {
  const options = postgresPoolConfig({ database, databaseTls: true, databasePoolMax: 8 })
  assert.equal(options.max, 8)
  assert.equal(options.connectionTimeoutMillis, 5000)
  assert.deepEqual(options.ssl, { rejectUnauthorized: true })
  assert.match(options.options!, /timezone=UTC/)
  assert.match(options.options!, /statement_timeout=12000/)
  for (const value of [
    "mysql://u:p@localhost/db",
    "postgresql://u:p@localhost/db?sslmode=disable",
    "postgresql://u@localhost/db",
    "postgresql://u:p@localhost/db#fragment",
  ])
    assert.throws(() =>
      postgresPoolConfig({ database: new URL(value), databaseTls: false }),
    )
})
test("only certainly rolled back serialization/deadlock failures may retry", () => {
  const error = (code: string, meta?: Record<string, unknown>) =>
    new Prisma.PrismaClientKnownRequestError("private diagnostic", {
      code,
      clientVersion: "7.10.0",
      meta,
    })
  assert.equal(retryableTransaction(error("P2034")), true)
  assert.equal(retryableTransaction(error("P2010", { code: "40001" })), true)
  assert.equal(retryableTransaction(error("P2010", { code: "40P01" })), true)
  for (const code of ["P1001", "P2002", "P2024", "P2028"])
    assert.equal(retryableTransaction(error(code)), false)
  assert.equal(retryableTransaction(new Error("timeout")), false)
})

test("migration CLI cannot downgrade production TLS or accept URL overrides", () => {
  const env = {
    MIGRATION_DATABASE_URL: database.href,
    NODE_ENV: "production",
    DATABASE_TLS: "true",
  }
  const url = new URL(migrationConnection(env)!)
  assert.equal(url.searchParams.get("sslmode"), "require")
  assert.equal(url.searchParams.get("sslaccept"), "strict")
  assert.throws(() => migrationConnection({ ...env, DATABASE_TLS: "false" }))
  assert.throws(() =>
    migrationConnection({
      ...env,
      MIGRATION_DATABASE_URL: database.href + "?sslmode=disable",
    }),
  )
})
