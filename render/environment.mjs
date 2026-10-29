import { createHash, createECDH } from "node:crypto"

function required(env, key) {
  const value = env[key]
  if (typeof value !== "string" || !value || value.length > 1024)
    throw new Error("missing_render_configuration")
  return value
}
export function privateHost(env, key) {
  const host = required(env, key)
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(host)) throw new Error("invalid_render_private_host")
  return host
}
export function databaseUrl(env, role) {
  const url = new URL("postgresql://placeholder/cardapio")
  url.hostname = privateHost(env, "RENDER_DATABASE_HOST")
  url.port = "5432"
  url.username = role === "migration" ? "cardapio_migrator" : "cardapio"
  url.password = required(env, "DATABASE_PASSWORD")
  return url.href
}
function redisUrl(env, database) {
  const url = new URL("redis://placeholder:6379")
  url.hostname = privateHost(env, "RENDER_REDIS_HOST")
  url.password = required(env, "REDIS_PASSWORD")
  url.pathname = `/${database}`
  return url.href
}
export function publicOrigin(value) {
  const url = new URL(value)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.port ||
    !url.hostname.includes(".")
  )
    throw new Error("invalid_render_public_origin")
  return url.origin
}
function seed(env, key) {
  const value = required(env, key)
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error("invalid_render_seed")
  const bytes = Buffer.from(value, "base64")
  if (bytes.length !== 32 || bytes.toString("base64") !== value)
    throw new Error("invalid_render_seed")
  return bytes
}
export function configureApiEnvironment(env) {
  const origin = publicOrigin(env.PUBLIC_ORIGIN || required(env, "RENDER_APP_URL"))
  const vapidSeed = seed(env, "VAPID_SEED")
  const ec = createECDH("prime256v1")
  for (let attempt = 0; attempt < 100; attempt++) {
    const key = createHash("sha256")
      .update("cardapio:vapid:v1:" + attempt)
      .update(vapidSeed)
      .digest()
    try {
      ec.setPrivateKey(key)
      break
    } catch {
      /* Reject out-of-range curve scalars. */
    }
  }
  const provider = new URL("http://placeholder:8080")
  provider.hostname = privateHost(env, "RENDER_EVOLUTION_HOST")
  const privateKey = ec.getPrivateKey()
  const result = {
    ...env,
    DATABASE_URL: databaseUrl(env, "app"),
    REDIS_URL: redisUrl(env, 0),
    SESSION_SECRET: createHash("sha256")
      .update("cardapio:session:v1")
      .update(seed(env, "SESSION_SEED"))
      .digest("hex"),
    VAPID_PUBLIC_KEY: ec.getPublicKey().toString("base64url"),
    VAPID_PRIVATE_KEY: Buffer.concat([
      Buffer.alloc(32 - privateKey.length),
      privateKey,
    ]).toString("base64url"),
    VAPID_SUBJECT: env.VAPID_SUBJECT || origin,
    CORS_ORIGINS: origin,
    EVOLUTION_URL: provider.href.replace(/\/$/, ""),
  }
  // Seeds are configuration material, never needed by application workers.
  delete result.SESSION_SEED
  delete result.VAPID_SEED
  return result
}
export function configureProviderEnvironment(env) {
  const url = new URL("postgresql://evolution@placeholder:5432/evolution")
  url.hostname = privateHost(env, "EVOLUTION_DATABASE_HOST")
  url.password = required(env, "EVOLUTION_DATABASE_PASSWORD")
  url.searchParams.set("schema", "public")
  return {
    ...env,
    DATABASE_CONNECTION_URI: url.href,
    CACHE_REDIS_URI: redisUrl(env, 6),
  }
}
