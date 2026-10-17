import { Failure } from "@cardapio/domain/failure"
import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  DATABASE_TLS: z.enum(["true", "false"]),
  DATABASE_CA_FILE: z.string().optional(),
  SESSION_SECRET: z.string().regex(/^[a-f0-9]{64,128}$/),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(28800),
  CORS_ORIGINS: z.string().min(1),
  SIGNUP_ENABLED: z.enum(["true", "false"]).default("false"),
  DOCS_ENABLED: z.enum(["true", "false"]).default("false"),
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
  let database: URL
  let origins: string[]
  try {
    database = new URL(env.DATABASE_URL)
    
    // PERMITE POSTGRESQL E POSTGRES (SUPABASE)
    const allowedProtocols = ["postgres:", "postgresql:", "mysql:"]
    
    if (
      !allowedProtocols.includes(database.protocol) ||
      !database.username ||
      !database.password ||
      !/^\/[a-zA-Z0-9_]+$/.test(database.pathname)
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
    host: env.HOST,
    port: env.PORT,
    database,
    databaseTls: env.DATABASE_TLS === "true",
    databaseCaFile: env.DATABASE_CA_FILE,
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