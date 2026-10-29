import { test } from "node:test"
import assert from "node:assert/strict"
import { createECDH, createHash } from "node:crypto"
import {
  configureApiEnvironment,
  configureProviderEnvironment,
  publicOrigin,
} from "../render/environment.mjs"
import { readBlueprint, resolveBlueprint } from "./blueprint.mjs"

const resolved = resolveBlueprint(await readBlueprint(), {
  generate: (key) => createHash("sha256").update(key).digest("base64"),
  origin: "https://cardapio-check.onrender.com",
})
test("replicas share session/push keys and URLs encode generated base64 passwords", () => {
  const first = configureApiEnvironment(resolved["cardapio-api"])
  const second = configureApiEnvironment(resolved["cardapio-api-replica"])
  for (const key of [
    "SESSION_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "DATABASE_URL",
    "REDIS_URL",
    "CORS_ORIGINS",
  ])
    assert.equal(first[key], second[key])
  assert.match(first.SESSION_SECRET, /^[a-f0-9]{64}$/)
  assert.equal(first.SESSION_SEED, undefined)
  assert.equal(first.VAPID_SEED, undefined)
  assert.equal(first.CORS_ORIGINS, "https://cardapio-check.onrender.com")
  const ec = createECDH("prime256v1")
  ec.setPrivateKey(Buffer.from(first.VAPID_PRIVATE_KEY, "base64url"))
  assert.equal(ec.getPublicKey().toString("base64url"), first.VAPID_PUBLIC_KEY)
  const password = "+/=?#:@ unsafe&value"
  const api = configureApiEnvironment({
    ...resolved["cardapio-api"],
    DATABASE_PASSWORD: password,
    REDIS_PASSWORD: password,
  })
  for (const key of ["DATABASE_URL", "REDIS_URL"]) {
    const url = new URL(api[key])
    assert.equal(decodeURIComponent(url.password), password)
    assert.equal(url.search, "")
    assert.equal(url.hash, "")
  }
  assert.equal(new URL(api.DATABASE_URL).username, "cardapio")
  assert.equal(api.VAPID_SUBJECT, api.CORS_ORIGINS)
})
test("provider uses isolated database, shared Redis database six and escaped credentials", () => {
  const password = "+/=?#:@ unsafe&value"
  const env = configureProviderEnvironment({
    ...resolved["cardapio-evolution"],
    EVOLUTION_DATABASE_PASSWORD: password,
  })
  const url = new URL(env.DATABASE_CONNECTION_URI)
  assert.equal(decodeURIComponent(url.password), password)
  assert.equal(url.pathname, "/evolution")
  assert.equal(url.search, "?schema=public")
  assert.equal(new URL(env.CACHE_REDIS_URI).pathname, "/6")
  assert.equal(
    decodeURIComponent(new URL(env.CACHE_REDIS_URI).password),
    resolved["cardapio-redis"].REDIS_PASSWORD,
  )
})
test("custom domains are explicit exact HTTPS origins; unsafe/missing configuration fails closed", () => {
  assert.equal(
    configureApiEnvironment({
      ...resolved["cardapio-api"],
      PUBLIC_ORIGIN: "https://pedidos.example.com/",
    }).CORS_ORIGINS,
    "https://pedidos.example.com",
  )
  for (const value of [
    "http://cardapio-check.onrender.com",
    "https://user:pass@loja.test",
    "https://loja.test/path",
    "https://loja.test?x=1",
    "https://loja.test#x",
    "*",
  ])
    assert.throws(() => publicOrigin(value))
  for (const patch of [
    { SESSION_SEED: "placeholder" },
    { VAPID_SEED: "" },
    { RENDER_DATABASE_HOST: "public.example.com" },
    { RENDER_REDIS_HOST: "127.0.0.1" },
    { RENDER_APP_URL: "" },
  ])
    assert.throws(() =>
      configureApiEnvironment({ ...resolved["cardapio-api"], ...patch }),
    )
})
