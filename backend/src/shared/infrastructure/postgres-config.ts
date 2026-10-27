import { readFileSync } from "node:fs"
import type { PoolConfig } from "pg"
import { Failure } from "@cardapio/domain/failure"

export interface DatabaseConfig {
  database: URL
  databaseTls: boolean
  databaseCaFile?: string
  databasePoolMax?: number
  databaseConnectionTimeoutMs?: number
}

export function postgresPoolConfig(config: DatabaseConfig): PoolConfig {
  const url = config.database
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    !Number.isInteger(config.databasePoolMax ?? 10) ||
    (config.databasePoolMax ?? 10) < 2 ||
    (config.databasePoolMax ?? 10) > 50 ||
    !Number.isInteger(config.databaseConnectionTimeoutMs ?? 5000) ||
    (config.databaseConnectionTimeoutMs ?? 5000) < 100 ||
    (config.databaseConnectionTimeoutMs ?? 5000) > 30000 ||
    !/^\/[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Failure(
      "CONFIGURATION",
      "Configure uma conexão PostgreSQL válida.",
      {},
      "invalid_postgresql_url",
    )
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    max: config.databasePoolMax ?? 10,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs ?? 5000,
    idleTimeoutMillis: 30000,
    maxLifetimeSeconds: 300,
    application_name: "cardapio-api",
    // Limit server work as well as client waits; dates have one interpretation.
    options:
      "-c timezone=UTC -c statement_timeout=12000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000",
    ssl: config.databaseTls
      ? {
          rejectUnauthorized: true,
          ...(config.databaseCaFile
            ? { ca: readFileSync(config.databaseCaFile, "utf8") }
            : {}),
        }
      : false,
  }
}
