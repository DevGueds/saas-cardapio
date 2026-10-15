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
  DATABASE_URL: "mysql://test:local@127.0.0.1/cardapio_test",
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
  assert.equal(loadConfig(env).signupEnabled, false)
  assert.equal(
    loadConfig({
      ...env,
      NODE_ENV: "production",
      CORS_ORIGINS: "https://menu.example",
      DATABASE_TLS: "true",
    }).secureCookies,
    true,
  )
})
test("schemas reject mass assignment and bad prices", () => {
  assert.equal(
    registrationSchema.safeParse({
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
