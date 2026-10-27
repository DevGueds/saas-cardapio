import { config as loadEnvironment } from "dotenv"
import { readFile, writeFile, rename, unlink } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"
import { importTables } from "./schema.js"
import { MysqlSource } from "./mysql-source.js"
import { PostgresTarget } from "./postgres-target.js"
import { transfer, verifyTransfer } from "./transfer.js"
import { postgresPoolConfig } from "../../src/shared/infrastructure/postgres-config.js"

loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true })

async function main() {
  const flags = process.argv.slice(2)
  const apply = flags.includes("--apply"),
    verify = flags.includes("--verify"),
    activate = flags.includes("--activate-local")
  if (
    flags.some(
      (flag) =>
        ![
          "--check",
          "--apply",
          "--verify",
          "--maintenance-confirmed",
          "--activate-local",
        ].includes(flag),
    ) ||
    flags.filter((flag) => ["--check", "--apply", "--verify"].includes(flag)).length >
      1 ||
    ((apply || activate) && !flags.includes("--maintenance-confirmed")) ||
    (activate && !apply && !verify)
  )
    throw new Error("import_arguments_invalid")
  if (!process.env.LEGACY_DATABASE_URL || !process.env.MIGRATION_DATABASE_URL)
    throw new Error("import_connections_required")
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.DATABASE_TLS !== "true" || process.env.LEGACY_DATABASE_TLS !== "true")
  )
    throw new Error("import_tls_required")
  const tables = importTables(
    await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8"),
  )
  const baseDirectory = fileURLToPath(new URL("../../", import.meta.url))
  const pool = new Pool({
    ...postgresPoolConfig({
      database: new URL(process.env.MIGRATION_DATABASE_URL),
      databaseTls: process.env.DATABASE_TLS === "true",
      databaseCaFile: process.env.DATABASE_CA_FILE
        ? resolve(baseDirectory, process.env.DATABASE_CA_FILE)
        : undefined,
    }),
    max: 1,
    application_name: "cardapio-legacy-import",
  })
  pool.on("error", () => {})
  let source: MysqlSource | undefined
  try {
    source = await MysqlSource.open(
      process.env.LEGACY_DATABASE_URL,
      process.env.LEGACY_DATABASE_TLS === "true",
      process.env.LEGACY_DATABASE_CA_FILE
        ? resolve(baseDirectory, process.env.LEGACY_DATABASE_CA_FILE)
        : undefined,
    )
    await source.validate(
      tables,
      new URL("../../prisma/legacy-mysql/migrations/", import.meta.url),
    )
    const connection = await pool.connect()
    try {
      const target = new PostgresTarget(connection)
      if (!apply && !verify) {
        console.log(
          JSON.stringify({
            mode: "check",
            source: await source.counts(tables),
            destination: await target.counts(tables),
          }),
        )
        return
      }
      // Activation is checked before committing data, not after an irreversible switch.
      const envFile = new URL("../../.env", import.meta.url)
      const original = activate ? await readFile(envFile, "utf8") : ""
      if (activate) {
        const local = parseEnv(original),
          runtime = new URL(local.DATABASE_URL!),
          destination = new URL(process.env.MIGRATION_DATABASE_URL)
        if (
          local.NODE_ENV !== "development" ||
          runtime.host !== destination.host ||
          runtime.pathname !== destination.pathname
        )
          throw new Error("import_local_activation_invalid")
      }
      let summary
      if (verify) {
        await connection.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
        try {
          summary = await verifyTransfer(tables, source, target)
        } finally {
          await connection.query("ROLLBACK")
        }
      } else summary = await transfer(tables, source, target)
      console.log(
        JSON.stringify({
          mode: apply ? "applied-and-verified" : "verified",
          tables: summary.map(({ table, rows }) => ({ table, rows })),
        }),
      )
      if (activate) {
        const { setEnvironmentValue } =
          await import("../../../scripts/postgres-environment.mjs")
        if ((await readFile(envFile, "utf8")) !== original)
          throw new Error("import_local_configuration_changed")
        const temporary = new URL(`../../.env.${randomUUID()}.tmp`, import.meta.url)
        try {
          await writeFile(
            temporary,
            setEnvironmentValue(original, "DATABASE_MIGRATION_PENDING", "false"),
            { encoding: "utf8", mode: 0o600, flag: "wx" },
          )
          await rename(temporary, envFile)
        } finally {
          await unlink(temporary).catch(() => {})
        }
        console.log(
          "PostgreSQL verificado e configuração local ativada. Inicie novamente as APIs; preserve os limites e dados de segurança do Redis.",
        )
      }
    } finally {
      connection.release()
    }
  } finally {
    try {
      await source?.close()
    } finally {
      await pool.end()
    }
  }
}

void main().catch((error: unknown) => {
  const code =
    error instanceof Error && /^import_[a-z_]+$/.test(error.message)
      ? error.message
      : "import_failed"
  const cause =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    (/^(?:[A-Z0-9]{5}|ER_[A-Z_]+)$/.test(error.code) ||
      [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ECONNRESET",
        "ENOTFOUND",
        "EHOSTUNREACH",
        "EPERM",
        "EACCES",
        "ENOENT",
      ].includes(error.code))
      ? error.code
      : undefined
  console.error(
    JSON.stringify({
      code,
      cause,
      diagnosticId: randomUUID(),
      message:
        "Importação interrompida. Confira schema, permissões e configuração; preserve a origem e o backup. Destino ocupado não é sobrescrito. Use --verify para conferir uma importação concluída.",
    }),
  )
  process.exitCode = 1
})
