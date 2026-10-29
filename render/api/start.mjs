import { configureApiEnvironment } from "../environment.mjs"
import { Client } from "pg"
import { loadConfig } from "../dist/app/config.js"
import { postgresPoolConfig } from "../dist/shared/infrastructure/postgres-config.js"
import { expectedMigrations, waitForMigrations } from "./readiness.mjs"

try {
  const environment = configureApiEnvironment(process.env)
  delete process.env.SESSION_SEED
  delete process.env.VAPID_SEED
  Object.assign(process.env, environment)
  const config = loadConfig(process.env)
  const expected = await expectedMigrations(
    new URL("../prisma/migrations/", import.meta.url),
  )
  await waitForMigrations(() => new Client(postgresPoolConfig(config)), expected)
  console.log(
    JSON.stringify({ event: "database_migrations_ready", count: expected.length }),
  )
  await import("../dist/main.js")
} catch {
  console.error(
    JSON.stringify({
      event: "api_startup_blocked",
      reason: "check_render_configuration_and_migrations",
    }),
  )
  process.exitCode = 1
}
