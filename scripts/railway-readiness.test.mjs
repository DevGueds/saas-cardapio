import { test } from "node:test"
import assert from "node:assert/strict"
import {
  expectedMigrations,
  migrationsMatch,
  waitForMigrations,
} from "../railway/api/readiness.mjs"

test("Railway startup requires committed migration checksums and completed records", async () => {
  const expected = await expectedMigrations(
    new URL("../backend/prisma/migrations/", import.meta.url),
  )
  assert.ok(expected.length)
  const rows = expected.map((entry) => ({
    migration_name: entry.name,
    checksum: entry.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }))
  assert.equal(migrationsMatch(expected, rows), true)
  for (const patch of [
    { checksum: "wrong" },
    { finished_at: null },
    { rolled_back_at: new Date() },
  ])
    assert.equal(
      migrationsMatch(expected, [{ ...rows[0], ...patch }, ...rows.slice(1)]),
      false,
    )
  assert.equal(migrationsMatch(expected, []), false)
})
test("startup retries schema race, closes every connection, and bounds failures", async () => {
  const expected = [{ name: "test", checksum: "checksum" }]
  let attempts = 0,
    closed = 0
  const connect = () => ({
    connect: async () => {
      attempts++
    },
    query: async () => ({
      rows:
        attempts < 2
          ? []
          : [
              {
                migration_name: "test",
                checksum: "checksum",
                finished_at: new Date(),
                rolled_back_at: null,
              },
            ],
    }),
    end: async () => {
      closed++
    },
  })
  await waitForMigrations(connect, expected, { timeoutMs: 1000, delayMs: 1 })
  assert.equal(attempts, 2)
  assert.equal(closed, 2)
  await assert.rejects(
    waitForMigrations(
      () => ({
        connect: async () => {
          throw new Error("private-dsn")
        },
        end: async () => {},
      }),
      expected,
      { timeoutMs: 10, delayMs: 1 },
    ),
    /database_migrations_not_ready/,
  )
})
