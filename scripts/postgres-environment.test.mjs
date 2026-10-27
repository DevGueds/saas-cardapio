import { test } from "node:test"
import assert from "node:assert/strict"
import { parseEnv } from "node:util"
import { configurePostgresEnvironment } from "./postgres-environment.mjs"

const secret = () => "a".repeat(48)
test("fresh PostgreSQL configuration is stable and does not rotate secrets on setup", () => {
  const first = configurePostgresEnvironment(
    "NODE_ENV=development\nSESSION_SECRET=keep-existing\n",
    secret,
  )
  assert.equal(first.upgraded, false)
  const env = parseEnv(first.contents)
  assert.ok(env.DATABASE_URL.startsWith("postgresql://cardapio:"))
  assert.ok(env.MIGRATION_DATABASE_URL.startsWith("postgresql://cardapio_migrator:"))
  assert.equal(env.SESSION_SECRET, "keep-existing")
  assert.deepEqual(
    configurePostgresEnvironment(first.contents, () => {
      throw new Error("must not rotate")
    }),
    first,
  )
})
test("legacy setup preserves source URLs, session encryption and blocks runtime pending import", () => {
  const legacy =
    "NODE_ENV=development\nDATABASE_URL=mysql://app:source@localhost/cardapio\nMIGRATION_DATABASE_URL=mysql://owner:source@localhost/cardapio\nTEST_DATABASE_URL=mysql://app:source@localhost/cardapio_test\nTEST_MIGRATION_DATABASE_URL=mysql://owner:source@localhost/cardapio_test\nSESSION_SECRET=keep-existing\n"
  const configured = configurePostgresEnvironment(legacy, secret),
    env = parseEnv(configured.contents)
  assert.equal(env.LEGACY_DATABASE_URL, parseEnv(legacy).DATABASE_URL)
  assert.equal(env.LEGACY_MIGRATION_DATABASE_URL, parseEnv(legacy).MIGRATION_DATABASE_URL)
  assert.equal(env.DATABASE_MIGRATION_PENDING, "true")
  assert.equal(env.SESSION_SECRET, "keep-existing")
  assert.ok(env.DATABASE_URL.startsWith("postgresql:"))
  assert.throws(() =>
    configurePostgresEnvironment(legacy.replace("development", "production"), secret),
  )
})
