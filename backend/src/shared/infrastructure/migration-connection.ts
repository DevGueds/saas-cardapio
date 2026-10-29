import { resolve } from "node:path"
import { railwayPrivateTransport } from "./private-network.js"

/** Prisma CLI uses its own driver; enforce the runtime transport policy. */
export function migrationConnection(
  env: Record<string, string | undefined>,
): string | undefined {
  if (!env.MIGRATION_DATABASE_URL) return undefined
  const url = new URL(env.MIGRATION_DATABASE_URL)
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !/^\/[a-zA-Z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    (env.NODE_ENV === "production" &&
      env.DATABASE_TLS !== "true" &&
      !railwayPrivateTransport(url, env))
  )
    throw new Error("Configuração PostgreSQL para migrations inválida.")
  const tls = env.DATABASE_TLS === "true"
  url.searchParams.set("sslmode", tls ? "require" : "disable")
  if (tls) {
    url.searchParams.set("sslaccept", "strict")
    if (env.DATABASE_CA_FILE)
      url.searchParams.set("sslcert", resolve(env.DATABASE_CA_FILE))
  }
  return url.href
}
