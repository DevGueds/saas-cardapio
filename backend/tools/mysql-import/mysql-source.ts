import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise"
import { readFileSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { identifier, legacyMigrationChecksums, type Table } from "./schema.js"
import { normalizedRow } from "./values.js"
import type { ImportSource } from "./transfer.js"

export class MysqlSource implements ImportSource {
  private constructor(private readonly connection: Connection) {}
  static async open(value: string, tls: boolean, caFile?: string) {
    const url = new URL(value)
    if (
      url.protocol !== "mysql:" ||
      !url.username ||
      !url.password ||
      !/^\/[\w]+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error("import_source_url_invalid")
    const connection = await createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      timezone: "Z",
      charset: "utf8mb4",
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      jsonStrings: true,
      multipleStatements: false,
      connectTimeout: 10000,
      ...(tls
        ? {
            ssl: {
              rejectUnauthorized: true,
              ...(caFile ? { ca: readFileSync(caFile, "utf8") } : {}),
            },
          }
        : {}),
    })
    return new MysqlSource(connection)
  }
  async validate(tables: Table[], migrations: URL) {
    const [applied] = await this.connection.query<RowDataPacket[]>(
      "SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
    )
    const directories = (await readdir(migrations, { withFileTypes: true })).filter((d) =>
      d.isDirectory(),
    )
    if (applied.length !== directories.length)
      throw new Error("import_source_migrations_incomplete")
    for (const directory of directories) {
      const sql = await readFile(new URL(`${directory.name}/migration.sql`, migrations))
      const checksums = legacyMigrationChecksums(sql)
      if (
        !applied.some(
          (row) =>
            row.migration_name === directory.name && checksums.has(String(row.checksum)),
        )
      )
        throw new Error("import_source_migration_mismatch")
    }
    const [columns] = await this.connection.query<RowDataPacket[]>(
      "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE()",
    )
    for (const table of tables) {
      const found = columns
        .filter((c) => c.TABLE_NAME === table.name)
        .map((c) => c.COLUMN_NAME as string)
        .sort()
      if (
        found.join(",") !==
        table.columns
          .map((c) => c.name)
          .sort()
          .join(",")
      )
        throw new Error("import_source_schema_mismatch")
    }
    await this.connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    await this.connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY")
  }
  async *pages(table: Table) {
    const quote = (name: string) => identifier(name, "mysql")
    const keys = table.keys.map(quote).join(",")
    let cursor: unknown[] | undefined
    for (;;) {
      const [rows] = await this.connection.query<RowDataPacket[]>(
        `SELECT ${table.columns.map((c) => quote(c.name)).join(",")} FROM ${quote(table.name)} ${cursor ? `WHERE (${keys}) > (${table.keys.map(() => "?").join(",")})` : ""} ORDER BY ${keys} LIMIT 5`,
        cursor ?? [],
      )
      if (!rows.length) return
      yield rows.map((row) => normalizedRow(table, row, "mysql"))
      cursor = table.keys.map((key) => rows[rows.length - 1]![key])
    }
  }
  async counts(tables: Table[]) {
    const counts: Record<string, number> = {}
    for (const table of tables) {
      const [rows] = await this.connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${identifier(table.name, "mysql")}`,
      )
      counts[table.name] = Number(rows[0]!.total)
    }
    return counts
  }
  async close() {
    try {
      await this.connection.rollback()
    } finally {
      await this.connection.end()
    }
  }
}
