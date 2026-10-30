import { currentLegalAcceptance } from "@cardapio/contracts"
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt } from "node:crypto"
import { generate } from "otplib"
import type { MfaSetup, RestaurantAccess, SessionView } from "@cardapio/contracts"
import { createApplication } from "../../src/app/bootstrap.js"
import { loadConfig } from "../../src/app/config.js"
import { PrismaIdentity } from "../../src/modules/identity/infrastructure/prisma-identity.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("MFA tests require an isolated _test database")
const origin = "http://localhost:8443",
  password = "mfa-test-passphrase",
  suffix = randomUUID().slice(0, 8)
let server: Awaited<ReturnType<typeof createApplication>>
const users: string[] = [],
  tenants: string[] = []
interface Login {
  cookie: string
  csrf: string
  userId: string
  email: string
  store?: RestaurantAccess
}
function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
  login?: Login,
  headers: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: `/api/v1${url}`,
    remoteAddress: `10.75.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    headers: {
      origin,
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
      ...headers,
    },
    ...(method !== "GET" ? { payload: payload ?? {} } : {}),
  })
}
function value<T>(response: { body: string }): T {
  const result = JSON.parse(response.body)
  assert.equal(result.ok, true, result.error?.code)
  return result.value
}
function accept(
  response: { body: string; headers: Record<string, unknown> },
  email: string,
  nested = false,
): Login {
  const result = value<SessionView | { session: SessionView }>(response),
    session = nested
      ? (result as { session: SessionView }).session
      : (result as SessionView)
  return {
    cookie: String(response.headers["set-cookie"]).split(";")[0]!,
    csrf: session.csrfToken,
    userId: session.user.id,
    email,
  }
}
async function register(label: string, store = true) {
  const email = `mfa-${label}-${suffix}@example.test`
  const response = await request(
    "POST",
    store ? "/auth/register" : "/auth/register-account",
    {
      legalAcceptance: currentLegalAcceptance,
      name: `Pessoa ${label}`,
      email,
      password,
      ...(store
        ? { restaurantName: `Loja ${label}`, slug: `mfa-${label}-${suffix}` }
        : {}),
    },
  )
  const login = accept(response, email)
  users.push(login.userId)
  await server.runtime.db.client.user.update({
    where: { id: login.userId },
    data: { emailVerifiedAt: new Date() },
  })
  if (store) {
    login.store = value<RestaurantAccess[]>(
      await request("GET", "/me/restaurants", undefined, login),
    )[0]!
    tenants.push(login.store.tenantId)
  }
  return login
}
async function login(user: Login) {
  return accept(
    await request("POST", "/auth/login", { email: user.email, password }),
    user.email,
  )
}
async function enroll(user: Login) {
  const setup = value<MfaSetup>(
    await request("POST", "/auth/mfa/setup", { currentPassword: password }, user),
  )
  const code = await generate({ secret: setup.secret })
  const response = await request("POST", "/auth/mfa/verify", { code }, user)
  const verified = { ...accept(response, user.email, true), store: user.store }
  return {
    verified,
    setup,
    code,
    recovery: value<{ recoveryCodes: string[] }>(response).recoveryCodes,
  }
}
before(async () => {
  server = await createApplication(
    loadConfig({
      ...process.env,
      MAIL_PROVIDER: "disabled",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      CLOUDFLARE_ORIGIN_SECRET: "",
      NODE_ENV: "test",
      DATABASE_URL: database,
      SIGNUP_ENABLED: "true",
      CORS_ORIGINS: origin,
    }),
  )
})
after(async () => {
  if (!server) return
  await server.runtime.db.transaction(async (tx) => {
    await tx.restaurant.deleteMany({ where: { tenantId: { in: tenants } } })
    await tx.membership.deleteMany({ where: { userId: { in: users } } })
    await tx.tenant.deleteMany({ where: { id: { in: tenants } } })
    await tx.user.deleteMany({ where: { id: { in: users } } })
  })
  await server.close()
})
test("MFA closes partial-session bypasses, rotates cookies, blocks replay, enforces tenant/role policy and reversible exemptions", async () => {
  const owner = await register("owner"),
    outsider = await register("outside"),
    staff = await register("staff", false)
  const ownerStore = owner.store!,
    tenant = ownerStore.tenantId
  const enabled = await enroll(owner),
    verified = enabled.verified
  assert.equal(enabled.recovery.length, 10)
  assert.notEqual(verified.cookie, owner.cookie)
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, owner)).statusCode,
    401,
  )
  const stored = await server.runtime.db.client.mfaCredential.findUniqueOrThrow({
    where: { userId: owner.userId },
  })
  assert.ok(!stored.secret.includes(enabled.setup.secret))
  assert.ok(!JSON.stringify(stored.recoveryHashes).includes(enabled.recovery[0]!))
  const challenge = await login(owner)
  assert.equal(
    value<SessionView>(await request("GET", "/auth/session", undefined, challenge)).mfa,
    "VERIFY",
  )
  for (const path of [
    "/me/restaurants",
    `/restaurants/${ownerStore.id}/menu`,
    `/tenants/${tenant}/security`,
  ])
    assert.equal((await request("GET", path, undefined, challenge)).statusCode, 403)
  assert.equal(
    (
      await request(
        "PUT",
        "/auth/password",
        { currentPassword: password, newPassword: "attacker-password" },
        challenge,
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (await request("POST", "/auth/mfa/verify", { code: enabled.code }, challenge))
      .statusCode,
    422,
  )
  const recoveryResponse = await request(
    "POST",
    "/auth/mfa/verify",
    { code: enabled.recovery[0] },
    challenge,
  )
  const recovered = accept(recoveryResponse, owner.email, true)
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, recovered)).statusCode,
    200,
  )
  assert.equal(
    (await request("POST", "/auth/mfa/verify", { code: enabled.recovery[0] }, recovered))
      .statusCode,
    422,
  )
  assert.equal(
    (
      await request(
        "POST",
        "/auth/mfa/verify",
        { code: enabled.recovery[1] },
        recovered,
        { "x-csrf-token": challenge.csrf },
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security`,
        { required: true, currentPassword: password },
        outsider,
      )
    ).statusCode,
    404,
  )
  value(
    await request(
      "POST",
      `/tenants/${tenant}/members`,
      { email: staff.email, role: "KITCHEN" },
      verified,
    ),
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security`,
        { required: true, currentPassword: password },
        staff,
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security`,
        { required: true, currentPassword: password },
        verified,
        { origin: "https://attacker.example" },
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security`,
        { required: true, currentPassword: password },
        verified,
        { "x-csrf-token": "" },
      )
    ).statusCode,
    403,
  )
  value(
    await request(
      "PUT",
      `/tenants/${tenant}/security`,
      { required: true, currentPassword: password },
      verified,
    ),
  )
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, staff)).statusCode,
    403,
  )
  assert.equal(
    value<SessionView>(await request("GET", "/auth/session", undefined, staff)).mfa,
    "ENROLL",
  )
  const disabled = await request(
    "DELETE",
    "/auth/mfa",
    { currentPassword: password, code: enabled.recovery[1] },
    verified,
  )
  assert.equal(disabled.statusCode, 403)
  value(
    await request(
      "PUT",
      `/tenants/${tenant}/security/${staff.userId}`,
      { override: "EXEMPT", currentPassword: password },
      verified,
    ),
  )
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, staff)).statusCode,
    200,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security/${outsider.userId}`,
        { override: "EXEMPT", currentPassword: password },
        verified,
      )
    ).statusCode,
    404,
  )
  value(
    await request(
      "PUT",
      `/tenants/${tenant}/security`,
      { required: false, currentPassword: password },
      verified,
    ),
  )
  // Personal MFA is preserved when the organization's requirement is switched off.
  assert.equal(
    value<SessionView>(
      await request("GET", "/auth/session", undefined, await login(owner)),
    ).mfa,
    "VERIFY",
  )
})
test("recovery races have a single winner and password reauthentication cannot be skipped", async () => {
  const user = await register("race"),
    enrolled = await enroll(user),
    first = await login(user),
    second = await login(user)
  const responses = await Promise.all(
    [first, second].map((session) =>
      request("POST", "/auth/mfa/verify", { code: enrolled.recovery[0] }, session),
    ),
  )
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 422])
  const winner = accept(
    responses.find((response) => response.statusCode === 201)!,
    user.email,
    true,
  )
  assert.equal(
    (
      await request(
        "DELETE",
        "/auth/mfa",
        { currentPassword: "incorrect-password", code: enrolled.recovery[1] },
        winner,
      )
    ).statusCode,
    422,
  )
  value(
    await request(
      "DELETE",
      "/auth/mfa",
      { currentPassword: password, code: enrolled.recovery[1] },
      winner,
    ),
  )
  for (const session of [winner, enrolled.verified, first, second])
    assert.equal(
      (await request("GET", "/auth/session", undefined, session)).statusCode,
      401,
    )
  assert.equal(
    value<SessionView>(
      await request("GET", "/auth/session", undefined, await login(user)),
    ).mfa,
    "NONE",
  )
})
test("enrollment is bound to a session, pending challenges expire and guesses are limited per account", async () => {
  const user = await register("limits"),
    other = await login(user)
  const setup = value<MfaSetup>(
    await request("POST", "/auth/mfa/setup", { currentPassword: password }, user),
  )
  assert.equal(
    (
      await request(
        "POST",
        "/auth/mfa/verify",
        { code: await generate({ secret: setup.secret }) },
        other,
      )
    ).statusCode,
    422,
  )
  for (let attempt = 0; attempt < 4; attempt++)
    assert.equal(
      (
        await request(
          "POST",
          "/auth/mfa/verify",
          { code: "000000000000000000000000" },
          user,
        )
      ).statusCode,
      422,
    )
  assert.equal(
    (
      await request(
        "POST",
        "/auth/mfa/verify",
        { code: "000000000000000000000000" },
        user,
      )
    ).statusCode,
    429,
  )
  await server.runtime.db.client.tenant.update({
    where: { id: user.store!.tenantId },
    data: { mfaRequired: true },
  })
  await server.runtime.db.client.session.updateMany({
    where: { userId: user.userId },
    data: { createdAt: new Date(Date.now() - 601000) },
  })
  assert.equal((await request("GET", "/auth/session", undefined, user)).statusCode, 401)
})

test("managers control their organization, cannot override an owner individually, and security changes are audited", async () => {
  const owner = await register("audit-owner"),
    manager = await register("audit-manager", false),
    tenant = owner.store!.tenantId
  value(
    await request(
      "POST",
      `/tenants/${tenant}/members`,
      { email: manager.email, role: "MANAGER" },
      owner,
    ),
  )
  const enabled = await enroll(manager),
    verified = enabled.verified
  value(
    await request(
      "PUT",
      `/tenants/${tenant}/security`,
      { required: true, currentPassword: password },
      verified,
    ),
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/tenants/${tenant}/security/${owner.userId}`,
        { override: "EXEMPT", currentPassword: password },
        verified,
      )
    ).statusCode,
    403,
  )
  value(
    await request(
      "PUT",
      `/tenants/${tenant}/security`,
      { required: false, currentPassword: password },
      verified,
    ),
  )
  const events = await server.runtime.db.client.securityEvent.findMany({
    where: { actorUserId: manager.userId },
    orderBy: { createdAt: "asc" },
  })
  assert.deepEqual(
    events.map((event) => event.action),
    ["MFA_ENABLED", "POLICY_REQUIRED", "POLICY_OPTIONAL"],
  )
  assert.ok(events.slice(1).every((event) => event.tenantId === tenant))
})

test("a login verified before a concurrent password change cannot create a session afterward", async () => {
  const user = await register("password-race")
  const previous = await server.runtime.db.client.user.findUniqueOrThrow({
    where: { id: user.userId },
  })
  value(
    await request(
      "PUT",
      "/auth/password",
      { currentPassword: password, newPassword: "new-test-passphrase" },
      user,
    ),
  )
  const repository = new PrismaIdentity(server.runtime.db)
  await assert.rejects(
    () =>
      repository.createSession(
        {
          id: randomUUID(),
          userId: user.userId,
          tokenHash: server.runtime.secrets.hash(randomUUID()),
          csrfHash: server.runtime.secrets.hash(randomUUID()),
          expiresAt: new Date(Date.now() + 60000),
        },
        previous.passwordHash,
      ),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "UNAUTHENTICATED",
  )
})
