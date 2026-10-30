import { isIP } from "node:net"
import { z } from "zod"
import { Failure } from "@cardapio/domain/failure"
import { privateTransport } from "../shared/infrastructure/private-network.js"

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
  CPU_WORKERS: z.coerce.number().int().min(1).max(4).default(2),
  REPORT_PARALLEL_THRESHOLD: z.coerce.number().int().min(100).max(10000).default(2000),
  CPU_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(7000),
  TRUSTED_PROXY_CIDRS: z.string().default(""),
  // Trust exactly N proxies directly in front of the API (e.g. 1 = the web proxy).
  // Only valid when the API is unreachable except through that proxy.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
  MAP_TILE_URL: z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  DATABASE_URL: z.string().min(1),
  DATABASE_TLS: z.enum(["true", "false"]),
  PRIVATE_NETWORK_TRANSPORT: z.enum(["tls", "railway", "render"]).default("tls"),
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
  SESSION_COOKIE_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
  CORS_ORIGINS: z.string().min(1),
  SIGNUP_ENABLED: z.enum(["true", "false"]).default("false"),
  DOCS_ENABLED: z.enum(["true", "false"]).default("false"),
  EMAIL_SEND_ENABLED: z.enum(["true", "false"]).default("false"),
  EMAIL_VERIFICATION_GRACE_SECONDS: z.coerce
    .number()
    .int()
    .min(3600)
    .max(2592000)
    .default(604800),
  MAIL_PROVIDER: z.enum(["disabled", "postal", "mailpit"]).default("disabled"),
  MAIL_API_URL: z.string().default(""),
  MAIL_API_KEY: z.string().max(512).default(""),
  MAIL_FROM: z.email().default("conta@localhost.invalid"),
  TURNSTILE_SITE_KEY: z.string().max(100).default(""),
  TURNSTILE_SECRET_KEY: z.string().max(200).default(""),
  TURNSTILE_HOSTNAMES: z.string().default(""),
  CLOUDFLARE_ORIGIN_SECRET: z
    .string()
    .regex(/^(?:[a-f0-9]{64}|)$/)
    .default(""),
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
  let secureCookies: boolean
  try {
    if (
      !!env.TURNSTILE_SITE_KEY !== !!env.TURNSTILE_SECRET_KEY ||
      (env.TURNSTILE_SECRET_KEY &&
        !env.TURNSTILE_HOSTNAMES.split(",").every((host) =>
          /^[a-z0-9.-]+$/.test(host.trim()),
        ))
    )
      throw new Error()
    if (env.EMAIL_SEND_ENABLED === "true") {
      if (env.MAIL_PROVIDER === "disabled") throw new Error()
      const mail = new URL(env.MAIL_API_URL)
      if (
        mail.username ||
        mail.password ||
        mail.search ||
        mail.hash ||
        mail.pathname !== "/" ||
        !["http:", "https:"].includes(mail.protocol) ||
        (env.MAIL_PROVIDER === "postal" &&
          ((mail.protocol !== "https:" && env.NODE_ENV === "production") ||
            env.MAIL_API_KEY.length < 16)) ||
        (env.MAIL_PROVIDER === "mailpit" &&
          (env.NODE_ENV === "production" ||
            !["127.0.0.1", "localhost", "[::1]", "mailpit"].includes(mail.hostname)))
      )
        throw new Error()
    }
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
      (env.NODE_ENV === "production" &&
        redis.protocol !== "rediss:" &&
        !privateTransport(redis, input))
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
    secureCookies =
      env.SESSION_COOKIE_SECURE === "auto"
        ? env.NODE_ENV === "production" ||
          origins.every((origin) => origin.startsWith("https:"))
        : env.SESSION_COOKIE_SECURE === "true"
    if (
      !secureCookies &&
      (env.NODE_ENV === "production" ||
        origins.some((origin) => origin.startsWith("https:")))
    )
      throw new Error()
    if (
      env.NODE_ENV === "production" &&
      ((env.DATABASE_TLS !== "true" && !privateTransport(database, input)) ||
        env.DOCS_ENABLED === "true")
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
    emailSendEnabled: env.EMAIL_SEND_ENABLED === "true",
    emailGraceSeconds: env.EMAIL_VERIFICATION_GRACE_SECONDS,
    mail: {
      provider: env.EMAIL_SEND_ENABLED === "true" ? env.MAIL_PROVIDER : "disabled",
      url: env.MAIL_API_URL.replace(/\/$/, ""),
      key: env.MAIL_API_KEY,
      from: env.MAIL_FROM,
    },
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    turnstileHosts: env.TURNSTILE_HOSTNAMES.split(",")
      .map((host) => host.trim())
      .filter(Boolean),
    cloudflareOriginSecret: env.CLOUDFLARE_ORIGIN_SECRET,
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
    cpuWorkers: env.CPU_WORKERS,
    reportParallelThreshold: env.REPORT_PARALLEL_THRESHOLD,
    cpuJobTimeoutMs: env.CPU_JOB_TIMEOUT_MS,
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
    signupEnabled:
      env.SIGNUP_ENABLED === "true" &&
      (env.EMAIL_SEND_ENABLED === "false" ||
        env.NODE_ENV !== "production" ||
        env.MAIL_PROVIDER === "postal"),
    docsEnabled: env.DOCS_ENABLED === "true",
    secureCookies,
    cookieName: secureCookies ? "__Host-cardapio_session" : "cardapio_session",
  }
}
