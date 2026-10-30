import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { randomBytes, randomInt, randomUUID } from "node:crypto"
import type { AddressInfo } from "node:net"
import {
  currentLegalAcceptance,
  type SessionView,
  type RestaurantAccess,
} from "@cardapio/contracts"
import { loadConfig } from "../../src/app/config.js"
import { createApplication } from "../../src/app/bootstrap.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Email tests require an isolated _test database.")
const origin = "http://localhost:8443",
  suffix = randomUUID().slice(0, 8),
  password = "M7!qR2@x"
const users: string[] = [],
  deliveries = new Map<string, string[]>()
let failDelivery = false
const mail = createServer(async (req, res) => {
  assert.equal(req.url, "/api/v1/send/message")
  assert.equal(req.headers["x-server-api-key"], "test-postal-key-for-isolated-fixtures")
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 32768) {
      req.destroy()
      return
    }
  }
  const data = JSON.parse(body),
    code = String(data.plain_body).match(/\b\d{6}\b/)?.[0]
  assert.ok(code)
  if (!failDelivery)
    deliveries.set(data.to[0], [...(deliveries.get(data.to[0]) ?? []), code])
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({ status: failDelivery ? "error" : "success" }))
})
let server: Awaited<ReturnType<typeof createApplication>>
interface Login {
  cookie: string
  csrf: string
  userId: string
  email: string
  session: SessionView
}
function value<T>(response: { body: string }): T {
  const body = JSON.parse(response.body)
  assert.equal(body.ok, true, body.error?.code)
  return body.value
}
function request(
  method: "GET" | "POST",
  path: string,
  payload?: unknown,
  login?: Login,
  extra: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: "/api/v1" + path,
    remoteAddress: `10.89.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    headers: {
      origin,
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
      ...extra,
    },
    ...(method === "POST" ? { payload: payload ?? {} } : {}),
  })
}
async function register(label: string, only = true) {
  const email = `${label}-${suffix}@example.test`
  const response = await request(
    "POST",
    only ? "/auth/register-account" : "/auth/register",
    {
      name: "Pessoa Teste",
      email,
      password,
      legalAcceptance: currentLegalAcceptance,
      ...(only ? {} : { restaurantName: "Loja Teste", slug: `email-${suffix}` }),
    },
  )
  assert.equal(response.statusCode, 201)
  const session = value<SessionView>(response)
  users.push(session.user.id)
  return {
    email,
    session,
    cookie: String(response.headers["set-cookie"]).split(";")[0]!,
    csrf: session.csrfToken,
    userId: session.user.id,
  }
}
const latest = (login: Login) => deliveries.get(login.email)!.at(-1)!
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0")
async function allowResend(login: Login) {
  await server.runtime.db.client.emailVerificationChallenge.update({
    where: { userId: login.userId },
    data: { retryAt: new Date(0) },
  })
}
before(async () => {
  await new Promise<void>((resolve) => mail.listen(0, "127.0.0.1", resolve))
  server = await createApplication(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: database,
      SIGNUP_ENABLED: "true",
      CORS_ORIGINS: origin,
      SESSION_SECRET: randomBytes(32).toString("hex"),
      EMAIL_VERIFICATION_GRACE_SECONDS: 3600,
      MAIL_PROVIDER: "postal",
      MAIL_API_URL: `http://127.0.0.1:${(mail.address() as AddressInfo).port}`,
      MAIL_API_KEY: "test-postal-key-for-isolated-fixtures",
      MAIL_FROM: "conta@example.test",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      CLOUDFLARE_ORIGIN_SECRET: "",
    }),
  )
})
after(async () => {
  if (server) {
    await server.runtime.db.transaction(async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId: { in: users }, role: "OWNER" },
      })
      const tenantId = { in: memberships.map((m) => m.tenantId) }
      await tx.restaurant.deleteMany({ where: { tenantId } })
      await tx.membership.deleteMany({ where: { userId: { in: users } } })
      await tx.tenant.deleteMany({ where: { id: tenantId } })
      await tx.user.deleteMany({ where: { id: { in: users } } })
    })
    await server.close()
  }
  await new Promise<void>((resolve, reject) =>
    mail.close((error) => (error ? reject(error) : resolve())),
  )
})
test(
  "real registration, keyed codes, grace enforcement, resend, attempts, team proof and recovery from mail failure",
  { timeout: 90000 },
  async () => {
    const weak = await request("POST", "/auth/register-account", {
      name: "Pessoa Teste",
      email: `weak-${suffix}@example.test`,
      password: "12345678",
      legalAcceptance: currentLegalAcceptance,
    })
    assert.equal(weak.statusCode, 422)
    const owner = await register("owner", false),
      member = await register("member")
    assert.equal(owner.session.emailVerification?.verified, false)
    assert.equal(owner.session.emailVerification?.required, false)
    const store = value<RestaurantAccess[]>(
      await request("GET", "/me/restaurants", undefined, owner),
    )[0]!
    assert.equal(
      (await request("GET", `/restaurants/${store.id}/menu`, undefined, owner))
        .statusCode,
      200,
    )
    const firstCode = latest(owner)
    const row =
      await server.runtime.db.client.emailVerificationChallenge.findUniqueOrThrow({
        where: { userId: owner.userId },
      })
    assert.match(row.codeHash, /^[a-f0-9]{64}$/)
    assert.notEqual(row.codeHash, firstCode)
    assert.equal(
      (await request("POST", "/auth/email/confirm", { code: firstCode })).statusCode,
      401,
    )
    assert.equal(
      (
        await request("POST", "/auth/email/confirm", { code: firstCode }, owner, {
          "x-csrf-token": "wrong",
        })
      ).statusCode,
      403,
    )
    assert.equal(
      (
        await request(
          "POST",
          "/auth/email/confirm",
          { code: firstCode, userId: member.userId },
          owner,
        )
      ).statusCode,
      422,
    )
    assert.equal((await request("POST", "/auth/email/send", {}, owner)).statusCode, 429)
    if (latest(member) !== firstCode)
      assert.equal(
        (await request("POST", "/auth/email/confirm", { code: firstCode }, member))
          .statusCode,
        422,
      )
    await server.runtime.db.client.user.update({
      where: { id: owner.userId },
      data: { emailVerificationDeadline: new Date(Date.now() - 1000) },
    })
    assert.equal(
      value<SessionView>(await request("GET", "/auth/session", undefined, owner))
        .emailVerification?.required,
      true,
    )
    const blocked = await request(
      "GET",
      `/restaurants/${store.id}/menu`,
      undefined,
      owner,
    )
    assert.equal(blocked.statusCode, 403)
    assert.equal(JSON.parse(blocked.body).error.code, "EMAIL_VERIFICATION_REQUIRED")
    const actor = {
      userId: owner.userId,
      sessionId: (
        await server.runtime.db.client.session.findFirstOrThrow({
          where: { userId: owner.userId },
        })
      ).id,
    }
    const direct = await server.runtime.tenancy.restaurants(actor)
    assert.equal(direct.ok, false)
    if (!direct.ok) assert.equal(direct.error.code, "EMAIL_VERIFICATION_REQUIRED")
    assert.equal(
      value<SessionView>(
        await request("POST", "/auth/login", { email: owner.email, password }),
      ).emailVerification?.required,
      true,
    )
    assert.equal((await request("GET", "/auth/email", undefined, owner)).statusCode, 200)
    await allowResend(owner)
    assert.equal((await request("POST", "/auth/email/send", {}, owner)).statusCode, 201)
    const secondCode = latest(owner)
    if (secondCode !== firstCode)
      assert.equal(
        (await request("POST", "/auth/email/confirm", { code: firstCode }, owner))
          .statusCode,
        422,
      )
    // Expired codes are rejected even when the value is correct.
    await server.runtime.db.client.emailVerificationChallenge.update({
      where: { userId: owner.userId },
      data: { expiresAt: new Date(0) },
    })
    assert.equal(
      (await request("POST", "/auth/email/confirm", { code: secondCode }, owner))
        .statusCode,
      422,
    )
    await allowResend(owner)
    assert.equal((await request("POST", "/auth/email/send", {}, owner)).statusCode, 201)
    const currentCode = latest(owner)
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await request(
            "POST",
            "/auth/email/confirm",
            { code: wrong(currentCode) },
            owner,
          )
        ).statusCode,
        422,
      )
    assert.equal(
      (
        await server.runtime.db.client.emailVerificationChallenge.findUniqueOrThrow({
          where: { userId: owner.userId },
        })
      ).attempts,
      5,
    )
    assert.equal(
      (await request("POST", "/auth/email/confirm", { code: currentCode }, owner))
        .statusCode,
      422,
    )
    await allowResend(owner)
    assert.equal((await request("POST", "/auth/email/send", {}, owner)).statusCode, 201)
    assert.equal(
      (await request("POST", "/auth/email/confirm", { code: latest(owner) }, owner))
        .statusCode,
      201,
    )
    assert.equal(
      await server.runtime.db.client.emailVerificationChallenge.findUnique({
        where: { userId: owner.userId },
      }),
      null,
    )
    assert.equal(
      await server.runtime.db.client.securityEvent.count({
        where: { actorUserId: owner.userId, action: "EMAIL_VERIFIED" },
      }),
      1,
    )
    assert.equal(
      (await request("GET", `/restaurants/${store.id}/menu`, undefined, owner))
        .statusCode,
      200,
    )
    assert.equal(
      (
        await request(
          "POST",
          `/tenants/${store.tenantId}/members`,
          { email: member.email, role: "STAFF" },
          owner,
        )
      ).statusCode,
      422,
    )
    assert.equal(
      (await request("POST", "/auth/email/confirm", { code: latest(member) }, member))
        .statusCode,
      201,
    )
    assert.equal(
      (
        await request(
          "POST",
          `/tenants/${store.tenantId}/members`,
          { email: member.email, role: "STAFF" },
          owner,
        )
      ).statusCode,
      201,
    )
    failDelivery = true
    const unavailable = await register("unavailable")
    assert.equal(
      await server.runtime.db.client.emailVerificationChallenge.findUnique({
        where: { userId: unavailable.userId },
      }),
      null,
    )
    assert.equal(
      (await request("POST", "/auth/email/send", {}, unavailable)).statusCode,
      503,
    )
    failDelivery = false
    assert.equal(
      (await request("POST", "/auth/email/send", {}, unavailable)).statusCode,
      201,
    )
    assert.equal(
      (
        await request(
          "POST",
          "/auth/email/confirm",
          { code: latest(unavailable) },
          unavailable,
        )
      ).statusCode,
      201,
    )
  },
)
test(
  "Cloudflare origin and missing challenge proof are enforced by real HTTP routes",
  { timeout: 60000 },
  async () => {
    const secret = "b".repeat(64)
    const gated = await createApplication({
      ...server.runtime.config,
      turnstileSiteKey: "test-site",
      turnstileSecretKey: "test-secret",
      turnstileHosts: ["localhost"],
      cloudflareOriginSecret: secret,
    })
    try {
      assert.equal(
        (await gated.app.inject({ method: "GET", url: "/api/v1/configuration" }))
          .statusCode,
        403,
      )
      assert.equal(
        (
          await gated.app.inject({
            method: "GET",
            url: "/api/v1/configuration",
            headers: { "x-cardapio-origin-secret": "forged" },
          })
        ).statusCode,
        403,
      )
      const configured = await gated.app.inject({
        method: "GET",
        url: "/api/v1/configuration",
        headers: { "x-cardapio-origin-secret": secret },
      })
      assert.equal(configured.statusCode, 200)
      assert.equal(
        value<{ turnstileSiteKey: string }>(configured).turnstileSiteKey,
        "test-site",
      )
      assert.ok(!configured.body.includes("test-secret"))
      for (const path of ["/auth/login", "/auth/register-account"]) {
        const response = await gated.app.inject({
          method: "POST",
          url: "/api/v1" + path,
          headers: { origin, "x-cardapio-origin-secret": secret },
          payload: path.endsWith("login")
            ? { email: `blocked-${suffix}@example.test`, password }
            : {
                name: "Pessoa Teste",
                email: `blocked-${suffix}@example.test`,
                password,
                legalAcceptance: currentLegalAcceptance,
              },
        })
        assert.equal(response.statusCode, 422)
        assert.equal(response.headers["set-cookie"], undefined)
        assert.match(response.body, /verificação de segurança/)
      }
      assert.equal(
        (await gated.app.inject({ method: "GET", url: "/api/v1/health/ready" }))
          .statusCode,
        200,
      )
    } finally {
      await gated.close()
    }
  },
)
