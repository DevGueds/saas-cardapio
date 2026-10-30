import { test } from "node:test"
import assert from "node:assert/strict"
import { Failure } from "@cardapio/domain/failure"
import { Turnstile } from "../../src/modules/identity/infrastructure/turnstile.js"
import {
  SecureEmailCodes,
  SelfHostedVerificationMail,
} from "../../src/modules/identity/infrastructure/verification-mail.js"
import { loadConfig } from "../../src/app/config.js"
const env = {
  NODE_ENV: "test",
  REDIS_URL: "redis://:test@127.0.0.1:6380/0",
  DATABASE_URL: "postgresql://test:local@127.0.0.1/cardapio_test",
  DATABASE_TLS: "false",
  SESSION_SECRET: "a".repeat(64),
  CORS_ORIGINS: "http://localhost:8443",
}

test("configuration rejects partial Turnstile, unsafe email transports and missing production mail", () => {
  for (const override of [
    { TURNSTILE_SITE_KEY: "site" },
    { TURNSTILE_SECRET_KEY: "secret" },
    {
      TURNSTILE_SITE_KEY: "site",
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_HOSTNAMES: "https://example.test",
    },
    { MAIL_PROVIDER: "mailpit", MAIL_API_URL: "https://attacker.test" },
    {
      MAIL_PROVIDER: "postal",
      MAIL_API_URL: "https://user:pass@mail.test",
      MAIL_API_KEY: "a".repeat(32),
    },
    { EMAIL_VERIFICATION_GRACE_SECONDS: 0 },
    { CLOUDFLARE_ORIGIN_SECRET: "weak" },
  ])
    assert.throws(() => loadConfig({ ...env, ...override }), Failure)
  const production = {
    ...env,
    NODE_ENV: "production",
    CORS_ORIGINS: "https://menu.example",
    REDIS_URL: "rediss://:test@127.0.0.1/0",
    DATABASE_TLS: "true",
    SIGNUP_ENABLED: "true",
  }
  assert.equal(loadConfig(production).signupEnabled, false)
  assert.throws(
    () =>
      loadConfig({
        ...production,
        MAIL_PROVIDER: "mailpit",
        MAIL_API_URL: "http://localhost:8025",
      }),
    Failure,
  )
  assert.throws(
    () =>
      loadConfig({
        ...production,
        MAIL_PROVIDER: "postal",
        MAIL_API_URL: "http://mail.example",
        MAIL_API_KEY: "a".repeat(32),
      }),
    Failure,
  )
  assert.equal(
    loadConfig({
      ...production,
      MAIL_PROVIDER: "postal",
      MAIL_API_URL: "https://mail.example",
      MAIL_API_KEY: "a".repeat(32),
    }).mail.provider,
    "postal",
  )
})
test("Turnstile validates success, hostname and action on the server and fails closed", async () => {
  let calls = 0
  const transport = (body: unknown, status = 200) =>
    (async (_url: unknown, options?: RequestInit) => {
      calls++
      const sent = JSON.parse(String(options?.body))
      assert.equal(sent.secret, "test-secret")
      assert.equal(sent.remoteip, "127.0.0.1")
      assert.equal(options?.redirect, "error")
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch
  const valid = new Turnstile(
    "test-secret",
    ["menu.test"],
    transport({ success: true, action: "register", hostname: "menu.test" }),
  )
  await assert.rejects(() => valid.verify(undefined, "127.0.0.1", "register"), Failure)
  assert.equal(calls, 0)
  await valid.verify("one-use-token", "127.0.0.1", "register")
  for (const body of [
    { success: false },
    { success: true, action: "login", hostname: "menu.test" },
    { success: true, action: "register", hostname: "attacker.test" },
    { success: true },
    null,
  ])
    await assert.rejects(
      () =>
        new Turnstile("test-secret", ["menu.test"], transport(body)).verify(
          "token",
          "127.0.0.1",
          "register",
        ),
      Failure,
    )
  await assert.rejects(
    () =>
      new Turnstile("test-secret", ["menu.test"], transport({}, 503)).verify(
        "token",
        "127.0.0.1",
        "register",
      ),
    (e) => e instanceof Failure && e.code === "CAPABILITY_UNAVAILABLE",
  )
  await new Turnstile("", [], transport({})).verify(undefined, "127.0.0.1", "login")
})
test("verification codes are six cryptographic digits and keyed to their owner and purpose", () => {
  const codes = new SecureEmailCodes("test-secret")
  for (let i = 0; i < 50; i++) assert.match(codes.create(), /^\d{6}$/)
  assert.equal(codes.hash("alice", "012345"), codes.hash("alice", "012345"))
  assert.notEqual(codes.hash("alice", "012345"), codes.hash("bob", "012345"))
  assert.notEqual(
    codes.hash("alice", "012345"),
    new SecureEmailCodes("other-secret").hash("alice", "012345"),
  )
})
test("Postal delivery requires a successful provider acknowledgement and never follows redirects", async () => {
  const config = {
    provider: "postal" as const,
    url: "https://mail.test",
    from: "conta@example.test",
    key: "test-key",
  }
  let captured: RequestInit | undefined
  const transport = (body: unknown, status = 200) =>
    (async (url: unknown, options?: RequestInit) => {
      assert.equal(url, "https://mail.test/api/v1/send/message")
      captured = options
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch
  await new SelfHostedVerificationMail(config, transport({ status: "success" })).send(
    "dummy@example.test",
    "012345",
  )
  assert.equal(captured?.redirect, "error")
  assert.equal(JSON.parse(String(captured?.body)).to[0], "dummy@example.test")
  for (const body of [{ status: "error" }, {}, null])
    await assert.rejects(() =>
      new SelfHostedVerificationMail(config, transport(body)).send(
        "dummy@example.test",
        "012345",
      ),
    )
  await assert.rejects(() =>
    new SelfHostedVerificationMail(config, transport({}, 500)).send(
      "dummy@example.test",
      "012345",
    ),
  )
  await assert.rejects(() =>
    new SelfHostedVerificationMail({ ...config, provider: "disabled" }).send(
      "dummy@example.test",
      "012345",
    ),
  )
})
