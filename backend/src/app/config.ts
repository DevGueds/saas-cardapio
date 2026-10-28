import { isIP } from "node:net"
import { z } from "zod"
import { Failure } from "@cardapio/domain/failure"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  LOG_DIRECTORY: z.string().max(500).default("logs"),
  LOG_INSTANCE: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,60}$/)
    .default("api"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  REDIS_URL: z.string().min(1),
  HTTP_RATE_LIMIT: z.coerce.number().int().min(60).max(100000).default(600),
  MAX_IN_FLIGHT: z.coerce.number().int().min(16).max(1024).default(128),
  TRUSTED_PROXY_CIDRS: z.string().default(""),
  // Trust exactly N proxies directly in front of the API (e.g. 1 = the web proxy).
  // Only valid when the API is unreachable except through that proxy.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  MAP_TILE_URL: z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  DATABASE_URL: z.string().min(1),
  DATABASE_TLS: z.enum(["true", "false"]),
  DATABASE_MIGRATION_PENDING: z.enum(["true", "false"]).default("false"),
  DATABASE_CA_FILE: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(50).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(5000),
  SESSION_SECRET: z.string().regex(/^[a-f0-9]{64,128}$/),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(28800),
  CORS_ORIGINS: z.string().min(1),
  SIGNUP_ENABLED: z.enum(["true", "false"]).default("false"),
  DOCS_ENABLED: z.enum(["true", "false"]).default("false"),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:admin@localhost.invalid"),
  EVOLUTION_URL: z.string().default(""),
  EVOLUTION_API_KEY: z.string().default(""),
})
export type ApiConfig = ReturnType<typeof loadConfig>
export function loadConfig(input: Record<string, unknown>) {
  const result = schema.safeParse(input)
  if (!result.success)
    throw new Failure(
      "CONFIGURATION",
      "Configuração da API inválida.",
      {},
      "invalid_environment",
    )
  const env = result.data
  let redis: URL
  let trustedProxies: string[]
  let database: URL
  let origins: string[]
  try {
    if (
      !!env.VAPID_PUBLIC_KEY !== !!env.VAPID_PRIVATE_KEY ||
      (env.VAPID_PUBLIC_KEY &&
        (!/^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY) ||
          !/^[A-Za-z0-9_-]{43}$/.test(env.VAPID_PRIVATE_KEY) ||
          !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(env.VAPID_SUBJECT)))
    )
      throw new Error()
    if (env.EVOLUTION_URL) {
      const provider = new URL(env.EVOLUTION_URL)
      if (
        !["http:", "https:"].includes(provider.protocol) ||
        provider.username ||
        provider.password ||
        provider.search ||
        provider.hash ||
        provider.pathname !== "/" ||
        env.EVOLUTION_API_KEY.length < 32
      )
        throw new Error()
    }
    redis = new URL(env.REDIS_URL)
    if (
      !["redis:", "rediss:"].includes(redis.protocol) ||
      !redis.password ||
      redis.search ||
      redis.hash ||
      !/^\/\d*$/.test(redis.pathname || "/") ||
      (env.NODE_ENV === "production" && redis.protocol !== "rediss:")
    )
      throw new Error()
    if (env.TRUSTED_PROXY_HOPS > 0 && env.TRUSTED_PROXY_CIDRS) throw new Error()
    trustedProxies = env.TRUSTED_PROXY_CIDRS
      ? env.TRUSTED_PROXY_CIDRS.split(",").map((v) => {
          const [ip, prefix] = v.trim().split("/")
          const version = isIP(ip!)
          if (
            !version ||
            (prefix !== undefined &&
              (!/^\d+$/.test(prefix) ||
                Number(prefix) < (version === 4 ? 8 : 32) ||
                Number(prefix) > (version === 4 ? 32 : 128)))
          )
            throw new Error()
          return v.trim()
        })
      : []
    const tile = new URL(env.MAP_TILE_URL)
    if (
      tile.protocol !== "https:" ||
      tile.username ||
      tile.password ||
      !["{z}", "{x}", "{y}"].every((p) => env.MAP_TILE_URL.includes(p))
    )
      throw new Error()
    database = new URL(env.DATABASE_URL)
    if (env.DATABASE_MIGRATION_PENDING === "true" && !database.pathname.endsWith("_test"))
      throw new Error()
    if (
      !["postgresql:", "postgres:"].includes(database.protocol) ||
      !database.username ||
      !database.password ||
      !/^\/[a-zA-Z0-9_]+$/.test(database.pathname) ||
      database.search ||
      database.hash
    )
      throw new Error()
    origins = env.CORS_ORIGINS.split(",").map((value) => {
      const url = new URL(value.trim())
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error()
      if (env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error()
      return url.origin
    })
    if (
      env.NODE_ENV === "production" &&
      (env.DATABASE_TLS !== "true" || env.DOCS_ENABLED === "true")
    )
      throw new Error()
  } catch {
    throw new Failure(
      "CONFIGURATION",
      "URLs ou configuração de segurança inválidas.",
      {},
      "unsafe_environment",
    )
  }
  return {
    environment: env.NODE_ENV,
    vapidPublicKey: env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
    evolutionUrl: env.EVOLUTION_URL.replace(/\/$/, ""),
    evolutionKey: env.EVOLUTION_API_KEY,
    logLevel: env.LOG_LEVEL,
    logDirectory: env.NODE_ENV === "test" ? undefined : env.LOG_DIRECTORY || undefined,
    logInstance: env.LOG_INSTANCE,
    host: env.HOST,
    port: env.PORT,
    database,
    redisUrl: redis.href,
    httpRateLimit: env.HTTP_RATE_LIMIT,
    maxInFlight: env.MAX_IN_FLIGHT,
    trustedProxies,
    trustedProxyHops: env.TRUSTED_PROXY_HOPS,
    mapTileUrl: env.MAP_TILE_URL,
    databaseTls: env.DATABASE_TLS === "true",
    databaseCaFile: env.DATABASE_CA_FILE,
    databasePoolMax: env.DATABASE_POOL_MAX,
    databaseConnectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS,
    secret: env.SESSION_SECRET,
    sessionTtl: env.SESSION_TTL_SECONDS,
    origins,
    signupEnabled: env.SIGNUP_ENABLED === "true",
    docsEnabled: env.DOCS_ENABLED === "true",
    secureCookies: env.NODE_ENV === "production",
    cookieName:
      env.NODE_ENV === "production" ? "__Host-cardapio_session" : "cardapio_session",
  }
}
