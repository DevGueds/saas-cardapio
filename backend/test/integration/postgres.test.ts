import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Database } from "../../src/shared/infrastructure/database.js"
import { loadConfig } from "../../src/app/config.js"

const value = process.env.TEST_DATABASE_URL
if (
  !value ||
  new URL(value).protocol !== "postgresql:" ||
  !new URL(value).pathname.endsWith("_test")
)
  throw new Error("Use um banco PostgreSQL exclusivo com sufixo _test.")
const config = loadConfig({ ...process.env, NODE_ENV: "test", DATABASE_URL: value })

test("PostgreSQL native types, indexes and least-privilege runtime survive migrations", async () => {
  const db = new Database(config)
  try {
    await db.connect()
    const permissions = await db.client.$queryRaw<
      {
        superuser: boolean
        create_schema: boolean
        truncate_users: boolean
        edit_history: boolean
        read_users: boolean
      }[]
    >`
      SELECT r.rolsuper AS superuser,
        has_schema_privilege(current_user, 'public', 'CREATE') AS create_schema,
        has_table_privilege(current_user, '"User"', 'TRUNCATE') AS truncate_users,
        has_table_privilege(current_user, '"_prisma_migrations"', 'UPDATE') AS edit_history,
        has_table_privilege(current_user, '"User"', 'SELECT') AS read_users
      FROM pg_roles r WHERE r.rolname = current_user`
    assert.deepEqual(permissions[0], {
      superuser: false,
      create_schema: false,
      truncate_users: false,
      edit_history: false,
      read_users: true,
    })
    const columns = await db.client.$queryRaw<
      { column_name: string; udt_name: string }[]
    >`
      SELECT column_name, udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Order'`
    const types = new Map(columns.map((c) => [c.column_name, c.udt_name]))
    assert.equal(types.get("id"), "uuid")
    assert.equal(types.get("items"), "jsonb")
    assert.equal(types.get("createdAt"), "timestamptz")
    const indexes = await db.client.$queryRaw<
      { indexdef: string }[]
    >`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Product'`
    assert.ok(indexes.some((index) => index.indexdef.includes('"categoryId"')))
  } finally {
    await db.close()
  }
})

test("read snapshots are consistent and cannot accidentally write", async () => {
  const db = new Database(config),
    id = randomUUID()
  try {
    await assert.rejects(() =>
      db.snapshot(async (tx) => {
        await tx.user.create({
          data: {
            id,
            name: "Fixture",
            email: `${id}@postgres.example.test`,
            passwordHash: "test-only",
          },
        })
      }),
    )
    assert.equal(await db.client.user.count({ where: { id } }), 0)
    const isolation = await db.snapshot(
      async (tx) =>
        tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`,
    )
    assert.equal(isolation[0]?.transaction_isolation, "repeatable read")
  } finally {
    await db.close()
  }
})
