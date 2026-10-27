import type { PoolClient } from "pg"
import { identifier, type Table } from "./schema.js"
import { normalizedRow } from "./values.js"
import type { ImportTarget } from "./transfer.js"

export class PostgresTarget implements ImportTarget {
  constructor(private readonly client: PoolClient) {}
  async counts(tables: Table[]) {
    const counts: Record<string, number> = {}
    for (const table of tables) {
      const result = await this.client.query(
        `SELECT COUNT(*)::text AS total FROM ${identifier(table.name, "postgres")}`,
      )
      counts[table.name] = Number(result.rows[0].total)
    }
    return counts
  }
  async begin(tables: Table[]) {
    await this.client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await this.client.query("SET LOCAL statement_timeout = '300s'")
    await this.client.query("SET LOCAL idle_in_transaction_session_timeout = '300s'")
    await this.client.query(
      `LOCK TABLE ${tables.map((t) => identifier(t.name, "postgres")).join(",")} IN ACCESS EXCLUSIVE MODE`,
    )
    if (Object.values(await this.counts(tables)).some((count) => count !== 0))
      throw new Error("import_destination_not_empty")
  }
  async insert(table: Table, rows: unknown[][]) {
    if (!rows.length) return
    const size = table.columns.length
    await this.client.query(
      `INSERT INTO ${identifier(table.name, "postgres")} (${table.columns.map((c) => identifier(c.name, "postgres")).join(",")}) VALUES ${rows.map((_, i) => `(${table.columns.map((_, j) => `$${i * size + j + 1}`).join(",")})`).join(",")}`,
      rows.flat(),
    )
  }
  async *pages(table: Table) {
    const quote = (name: string) => identifier(name, "postgres")
    const keys = table.keys.map(quote).join(",")
    const projection = table.columns
      .map((c) =>
        c.type === "Json" ? `${quote(c.name)}::text AS ${quote(c.name)}` : quote(c.name),
      )
      .join(",")
    let cursor: unknown[] | undefined
    for (;;) {
      const result = await this.client.query(
        `SELECT ${projection} FROM ${quote(table.name)} ${cursor ? `WHERE (${keys}) > (${table.keys.map((_, i) => `$${i + 1}`).join(",")})` : ""} ORDER BY ${keys} LIMIT 5`,
        cursor,
      )
      if (!result.rows.length) return
      yield result.rows.map((row) =>
        normalizedRow(table, row as Record<string, unknown>, "postgres"),
      )
      cursor = table.keys.map((key) => result.rows[result.rows.length - 1][key])
    }
  }
  async commit() {
    await this.client.query("COMMIT")
  }
  async rollback() {
    await this.client.query("ROLLBACK")
  }
}
