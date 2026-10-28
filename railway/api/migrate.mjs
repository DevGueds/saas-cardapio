import { spawn } from "node:child_process"
import { Client } from "pg"
import { migrationConnection } from "../dist/shared/infrastructure/migration-connection.js"
import { railwayPrivateTransport } from "../dist/shared/infrastructure/private-network.js"
try {
  const connection = migrationConnection(process.env)
  if (!connection) throw new Error("missing_configuration")
  const url = new URL(process.env.MIGRATION_DATABASE_URL)
  if (!railwayPrivateTransport(url, process.env))
    throw new Error("private_network_required")
  const options = {
    connectionString: url.href,
    ssl: false,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  }
  const deadline = Date.now() + 120000
  for (;;) {
    const client = new Client(options)
    try {
      await client.connect()
      await client.query("SELECT 1")
      break
    } catch {
      if (Date.now() >= deadline) throw new Error("database_unavailable")
      await new Promise((resolve) => setTimeout(resolve, 1500))
    } finally {
      await client.end().catch(() => undefined)
    }
  }
  await new Promise((resolve, reject) => {
    const child = spawn(
      "prisma",
      ["migrate", "deploy", "--config", "/app/railway/prisma.config.mjs"],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 180000 },
    )
    let diagnostic = "migration_failed",
      size = 0
    child.stderr.on("data", (chunk) => {
      size += chunk.length
      if (size < 32768)
        diagnostic = chunk.toString().match(/\bP[0-9]{4}\b/)?.[0] ?? diagnostic
    })
    child.on("error", () => reject(new Error("migration_command_unavailable")))
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(diagnostic))))
  })
  const client = new Client(options)
  try {
    await client.connect()
    await client.query(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE "_prisma_migrations" FROM cardapio',
    )
    await client.query(
      'GRANT SELECT (migration_name, checksum, finished_at, rolled_back_at) ON TABLE "_prisma_migrations" TO cardapio',
    )
  } finally {
    await client.end()
  }
  console.log(JSON.stringify({ event: "migrations_completed" }))
} catch (error) {
  const reason = /^P[0-9]{4}$/.test(error.message)
    ? error.message
    : "check_database_configuration_and_migration_files"
  console.error(JSON.stringify({ event: "migration_failed", reason }))
  process.exitCode = 1
}
