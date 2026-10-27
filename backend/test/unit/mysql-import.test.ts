import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { importTables, identifier, type Table } from "../../tools/mysql-import/schema.js"
import { canonical, normalizedRow } from "../../tools/mysql-import/values.js"
import { legacyMigrationChecksums } from "../../tools/mysql-import/schema.js"
import {
  transfer,
  verifyTransfer,
  type ImportTarget,
} from "../../tools/mysql-import/transfer.js"

const table: Table = {
  name: "Example",
  keys: ["id"],
  columns: [{ name: "id", type: "String", uuid: true, nullable: false }],
}
test("migration checksums accept only known LF/CRLF representations of identical SQL", () => {
  const lf = Buffer.from("CREATE TABLE fixture;\nSELECT 1;\n")
  const crlf = Buffer.from(lf.toString().replaceAll("\n", "\r\n"))
  assert.deepEqual(legacyMigrationChecksums(lf), legacyMigrationChecksums(crlf))
  const changed = legacyMigrationChecksums(
    Buffer.from("CREATE TABLE changed;\nSELECT 1;\n"),
  )
  assert.ok([...changed].every((checksum) => !legacyMigrationChecksums(lf).has(checksum)))
})
test("legacy transfer orders all current model dependencies and refuses unsupported mappings", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8")
  const tables = importTables(schema),
    names = tables.map((t) => t.name)
  assert.equal(tables.length, 19)
  assert.ok(names.indexOf("User") < names.indexOf("Membership"))
  assert.ok(names.indexOf("Order") < names.indexOf("Payment"))
  assert.ok(names.indexOf("NotificationEvent") < names.indexOf("NotificationDelivery"))
  assert.throws(() => identifier('User"; DROP TABLE', "postgres"))
  assert.throws(() => importTables('model Missing {\n id String @id @map("x")\n}'))
  assert.throws(() =>
    importTables("model Unsupported {\n id String @id\n amount Float\n}"),
  )
})
test("legacy values preserve JSON null versus SQL NULL, UTC, Unicode and exact bigint", () => {
  const spec: Table = {
    name: "Example",
    keys: ["id"],
    columns: [
      table.columns[0]!,
      { name: "json", type: "Json", uuid: false, nullable: true },
      { name: "at", type: "DateTime", uuid: false, nullable: false },
      { name: "counter", type: "BigInt", uuid: false, nullable: false },
      { name: "enabled", type: "Boolean", uuid: false, nullable: false },
    ],
  }
  const input = {
    id: "ABCDEFAB-1234-4234-8234-ABCDEFABCDEF",
    json: '{"z":"Açaí 🍕","a":null}',
    at: "2026-10-27 12:34:56.789",
    counter: "9007199254740993",
    enabled: 1,
  }
  assert.deepEqual(normalizedRow(spec, input, "mysql"), [
    input.id.toLowerCase(),
    '{"a":null,"z":"Açaí 🍕"}',
    "2026-10-27T12:34:56.789Z",
    "9007199254740993",
    true,
  ])
  assert.notEqual(
    normalizedRow(spec, { ...input, json: null }, "mysql")[1],
    normalizedRow(spec, { ...input, json: "null" }, "mysql")[1],
  )
  for (const changed of [
    { at: "2026-02-30 00:00:00" },
    { id: "invalid" },
    { enabled: 2 },
    { counter: 9007199254740993 },
    { json: "{" },
    { json: '{"counter":9007199254740993}' },
    { json: '{"counter":1e1000}' },
  ])
    assert.throws(() => normalizedRow(spec, { ...input, ...changed }, "mysql"))
  assert.equal(
    canonical({ b: [1, null], a: false }),
    canonical({ a: false, b: [1, null] }),
  )
})
test("transfer commits only verified rows; mismatches and occupied destinations roll back", async () => {
  const source = {
    async *pages() {
      yield [["first"]]
      yield [["second"]]
    },
  }
  let stored: unknown[][] = [],
    committed = 0,
    rolledBack = 0,
    corrupt = false,
    occupied = false
  const target: ImportTarget = {
    begin: async () => {
      if (occupied) throw new Error("import_destination_not_empty")
    },
    insert: async (_, rows) => {
      stored.push(...rows)
    },
    async *pages() {
      yield corrupt ? [["changed"]] : stored
    },
    commit: async () => {
      committed++
    },
    rollback: async () => {
      stored = []
      rolledBack++
    },
  }
  assert.equal((await transfer([table], source, target))[0]?.rows, 2)
  assert.equal(committed, 1)
  assert.equal((await verifyTransfer([table], source, target))[0]?.rows, 2)
  stored = []
  corrupt = true
  await assert.rejects(
    () => transfer([table], source, target),
    /import_verification_failed/,
  )
  assert.equal(committed, 1)
  assert.equal(rolledBack, 1)
  corrupt = false
  occupied = true
  await assert.rejects(
    () => transfer([table], source, target),
    /import_destination_not_empty/,
  )
  assert.equal(committed, 1)
  assert.equal(rolledBack, 2)
})
