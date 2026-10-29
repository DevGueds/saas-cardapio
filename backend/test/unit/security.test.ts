import { currentLegalAcceptance } from "@cardapio/contracts"
import { imageReference } from "@cardapio/domain/validation"
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { password, registrationSchema } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import { parseMoney } from "@cardapio/domain/money"
import { loadConfig } from "../../src/app/config.js"
import { assertPermission } from "../../src/modules/identity/domain/identity.js"
import { assertTransition } from "../../src/modules/orders/domain/order.js"
import { Operation } from "../../src/shared/application/operation.js"
import { ArgonPasswords, NodeSecrets } from "../../src/shared/infrastructure/runtime.js"
const env = {
  NODE_ENV: "test",
  REDIS_URL: "redis://:test@localhost:6380/0",
  DATABASE_URL: "postgresql://test:local@127.0.0.1/cardapio_test",
  DATABASE_TLS: "false",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  CORS_ORIGINS: "http://localhost:8443",
}
test("password accepts exactly eight characters, spaces and Unicode without trim", () => {
  assert.equal(password.safeParse("12345678").success, true)
  assert.equal(password.safeParse("1234567").success, false)
  assert.equal(password.parse(" frase  "), " frase  ")
  assert.equal(password.safeParse("🍕".repeat(8)).success, true)
  assert.equal(password.safeParse("x".repeat(129)).success, false)
})
test("Argon2id hashes passwords and rejects wrong credentials", async () => {
  const hasher = await ArgonPasswords.create(),
    hash = await hasher.hash("12345678")
  assert.match(hash, /^\$argon2id\$/)
  assert.equal(await hasher.verify(hash, "12345678"), true)
  assert.equal(await hasher.verify(hash, "1234567"), false)
  assert.equal(await hasher.verify("invalid", "12345678"), false)
})
test("configuration has no implicit environment or insecure production defaults", () => {
  assert.throws(() => loadConfig({}), Failure)
  assert.throws(() => loadConfig({ ...env, NODE_ENV: "production" }), Failure)
  assert.throws(() => loadConfig({ ...env, CORS_ORIGINS: "*" }), Failure)
  assert.throws(() => loadConfig({ ...env, SESSION_SECRET: "" }), Failure)
  assert.throws(
    () => loadConfig({ ...env, DATABASE_URL: "mysql://test:local@localhost/cardapio" }),
    Failure,
  )
  assert.throws(
    () =>
      loadConfig({
        ...env,
        DATABASE_URL: "postgresql://test:local@localhost/cardapio",
        DATABASE_MIGRATION_PENDING: "true",
      }),
    Failure,
  )
  assert.throws(() => loadConfig({ ...env, DATABASE_POOL_MAX: "0" }), Failure)
  assert.equal(loadConfig(env).signupEnabled, false)
  assert.equal(
    loadConfig({
      ...env,
      NODE_ENV: "production",
      CORS_ORIGINS: "https://menu.example",
      DATABASE_TLS: "true",
      REDIS_URL: "rediss://:test@localhost:6380/0",
    }).secureCookies,
    true,
  )
})
test("HTTP LAN is allowed only in development/test; production still requires HTTPS and secure cookies", () => {
  const lan = "http://192.168.1.50:8080"
  assert.deepEqual(
    loadConfig({ ...env, NODE_ENV: "development", CORS_ORIGINS: lan }).origins,
    [lan],
  )
  assert.throws(
    () =>
      loadConfig({
        ...env,
        NODE_ENV: "production",
        DATABASE_TLS: "true",
        REDIS_URL: "rediss://:test@localhost:6380/0",
        CORS_ORIGINS: lan,
      }),
    Failure,
  )
})

test("Railway private mesh is explicit and never permits public plaintext services", () => {
  const privateEnv = {
    ...env,
    NODE_ENV: "production",
    CORS_ORIGINS: "https://menu.example",
    PRIVATE_NETWORK_TRANSPORT: "railway",
    RAILWAY_PROJECT_ID: "test-project",
    RAILWAY_ENVIRONMENT_ID: "test-environment",
    DATABASE_TLS: "false",
    DATABASE_URL: "postgresql://app:test@postgres.railway.internal/cardapio",
    REDIS_URL: "redis://:test@redis.railway.internal:6379/0",
  }
  assert.equal(loadConfig(privateEnv).secureCookies, true)
  for (const override of [
    { PRIVATE_NETWORK_TRANSPORT: "tls" },
    { RAILWAY_PROJECT_ID: "" },
    { RAILWAY_ENVIRONMENT_ID: "" },
    { DATABASE_URL: "postgresql://app:test@postgres.example/cardapio" },
    { REDIS_URL: "redis://:test@redis.example:6379/0" },
    { REDIS_URL: "redis://:test@redis.railway.internal.attacker.example/0" },
    { CORS_ORIGINS: "http://menu.example" },
    { DOCS_ENABLED: "true" },
  ])
    assert.throws(() => loadConfig({ ...privateEnv, ...override }), Failure)
})
test("Render private transport requires provider context, exact internal hosts and secure cookies", () => {
  const privateEnv = {
    ...env,
    NODE_ENV: "production",
    RENDER: "true",
    RENDER_SERVICE_ID: "srv-abcdefghijklmnopqrst",
    RENDER_SERVICE_TYPE: "pserv",
    PRIVATE_NETWORK_TRANSPORT: "render",
    RENDER_DATABASE_HOST: "cardapio-postgres-abcd",
    RENDER_REDIS_HOST: "cardapio-redis-abcd",
    DATABASE_URL: "postgresql://cardapio:test@cardapio-postgres-abcd:5432/cardapio",
    REDIS_URL: "redis://:test@cardapio-redis-abcd:6379/0",
    CORS_ORIGINS: "https://cardapio-web.onrender.com",
  }
  assert.equal(loadConfig(privateEnv).secureCookies, true)
  for (const override of [
    { RENDER: "false" },
    { RENDER_SERVICE_ID: "" },
    { RENDER_SERVICE_TYPE: "web" },
    { PRIVATE_NETWORK_TRANSPORT: "tls" },
    { RENDER_DATABASE_HOST: "" },
    {
      RENDER_DATABASE_HOST: "127.0.0.1",
      DATABASE_URL: "postgresql://u:p@127.0.0.1/cardapio",
    },
    {
      RENDER_DATABASE_HOST: "db.example.com",
      DATABASE_URL: "postgresql://u:p@db.example.com/cardapio",
    },
    { DATABASE_URL: "postgresql://u:p@cardapio-postgres-abcd.attacker.test/cardapio" },
    { DATABASE_URL: "postgresql://u:p@different-private-service/cardapio" },
    { DATABASE_URL: "postgresql://u:p@cardapio-postgres-abcd:5433/cardapio" },
    { REDIS_URL: "redis://:p@cardapio-redis-abcd:6380/0" },
    { REDIS_URL: "redis://:p@redis.example.com:6379/0" },
    { SESSION_COOKIE_SECURE: "false" },
    { CORS_ORIGINS: "http://cardapio-web.onrender.com" },
  ])
    assert.throws(() => loadConfig({ ...privateEnv, ...override }), Failure)
})

test("proxy trust is off by default, bounded, and never combines hops with CIDRs", () => {
  assert.equal(loadConfig(env).trustedProxyHops, 0)
  assert.equal(loadConfig({ ...env, TRUSTED_PROXY_HOPS: "1" }).trustedProxyHops, 1)
  for (const hops of ["-1", "3", "1.5", "abc"])
    assert.throws(() => loadConfig({ ...env, TRUSTED_PROXY_HOPS: hops }), Failure)
  assert.throws(
    () =>
      loadConfig({
        ...env,
        TRUSTED_PROXY_HOPS: "1",
        TRUSTED_PROXY_CIDRS: "10.0.0.0/8",
      }),
    Failure,
  )
  assert.deepEqual(
    loadConfig({ ...env, TRUSTED_PROXY_CIDRS: "10.0.0.0/8" }).trustedProxies,
    ["10.0.0.0/8"],
  )
})

test("cookie mode supports local HTTP and keeps free Railway HTTPS domains secure", () => {
  assert.equal(
    loadConfig({ ...env, SESSION_COOKIE_SECURE: "false" }).secureCookies,
    false,
  )
  const prod = {
    ...env,
    NODE_ENV: "production",
    DATABASE_TLS: "true",
    REDIS_URL: "rediss://:test@localhost/0",
    CORS_ORIGINS: "https://loja-test.up.railway.app",
  }
  for (const mode of ["auto", "true"]) {
    const config = loadConfig({ ...prod, SESSION_COOKIE_SECURE: mode })
    assert.equal(config.secureCookies, true)
    assert.equal(config.cookieName, "__Host-cardapio_session")
  }
  assert.throws(() => loadConfig({ ...prod, SESSION_COOKIE_SECURE: "false" }), Failure)
  assert.throws(
    () =>
      loadConfig({
        ...env,
        CORS_ORIGINS: "https://localhost",
        SESSION_COOKIE_SECURE: "false",
      }),
    Failure,
  )
  assert.throws(() => loadConfig({ ...env, SESSION_COOKIE_SECURE: "invalid" }), Failure)
})

test("schemas reject mass assignment and bad prices", () => {
  assert.equal(
    registrationSchema.safeParse({
      legalAcceptance: currentLegalAcceptance,
      name: "Maria",
      email: "a@example.test",
      password: "12345678",
      restaurantName: "Loja",
      slug: "loja",
      role: "OWNER",
    }).success,
    false,
  )
  assert.equal(parseMoney("28.90", "price", true), 2890)
  for (const value of ["1,23abc", "Infinity", "0", "21474836.48"])
    assert.throws(() => parseMoney(value, "price", true), Failure)
})
test("permissions and order state machine deny unknown or illegal transitions", () => {
  assert.throws(() => assertPermission("STAFF", "catalog:write"), Failure)
  assert.doesNotThrow(() => assertPermission("STAFF", "orders:write"))
  assert.throws(() => assertTransition("NEW", "COMPLETED"), Failure)
  assert.throws(() => assertTransition("COMPLETED", "PREPARING"), Failure)
  assert.doesNotThrow(() => assertTransition("NEW", "PREPARING"))
})
test("opaque tokens and CSRF hashes are distinct, random and verifiable", () => {
  const secrets = new NodeSecrets(env.SESSION_SECRET),
    first = secrets.create()
  assert.notEqual(first, secrets.create())
  assert.equal(
    secrets.equalHash(secrets.csrf(first), secrets.hash(secrets.csrf(first))),
    true,
  )
  assert.equal(secrets.equalHash("forged", secrets.hash(secrets.csrf(first))), false)
})
test("diagnostics never serialize arbitrary exception payloads or personal information", async () => {
  const logs: unknown[] = []
  const operation = new Operation(
    {
      record: (event) => {
        logs.push(event)
      },
    },
    { next: () => "diagnostic" },
    { now: () => new Date(0) },
  )
  const result = await operation.run("test.operation", async () => {
    throw new Error("customer@example.test secret-token private-order")
  })
  assert.equal(result.ok, false)
  assert.doesNotMatch(
    JSON.stringify({ result, logs }),
    /customer@|secret-token|private-order/,
  )
})

test("inline images enforce type signatures and the five MiB byte limit", () => {
  assert.throws(() => imageReference("data:image/png;base64,PHNjcmlwdD4="), Failure)
  assert.throws(() => imageReference("data:image/svg+xml;base64,PHN2Zz4="), Failure)
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 1)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  assert.throws(
    () => imageReference("data:image/png;base64," + bytes.toString("base64")),
    Failure,
  )
})

test("Zod validation returns detailed safe errors for every invalid field", async () => {
  const { validate } = await import("../../src/shared/application/validate.js")
  try {
    validate(registrationSchema, {
      legalAcceptance: currentLegalAcceptance,
      name: "123",
      email: "invalid",
      password: "1234567",
      restaurantName: "",
      slug: "Bad slug",
    })
    assert.fail("Invalid registration must fail closed")
  } catch (error) {
    assert.ok(error instanceof Failure)
    assert.equal(error.code, "VALIDATION")
    assert.match(error.fields.name!, /Use letras/)
    assert.match(error.fields.email!, /e-mail válido/)
    assert.match(error.fields.password!, /8 caracteres/)
    assert.match(error.fields.restaurantName!, /Preencha/)
    assert.match(error.fields.slug!, /minúsculas/)
    assert.ok(!JSON.stringify(error.fields).includes("Bad slug"))
  }
})
