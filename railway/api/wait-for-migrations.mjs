import { Client } from "pg"
import { loadConfig } from "../dist/app/config.js"
import { postgresPoolConfig } from "../dist/shared/infrastructure/postgres-config.js"
import { expectedMigrations, waitForMigrations } from "./readiness.mjs"
try {
  const config = loadConfig(process.env)
  const expected = await expectedMigrations(
    new URL("../prisma/migrations/", import.meta.url),
  )
  await waitForMigrations(() => new Client(postgresPoolConfig(config)), expected)
  console.log(
    JSON.stringify({ event: "database_migrations_ready", count: expected.length }),
  )
} catch {
  console.error(
    JSON.stringify({
      event: "api_startup_blocked",
      reason: "check_configuration_dependencies_and_migrate_service",
    }),
  )
  process.exitCode = 1
}
