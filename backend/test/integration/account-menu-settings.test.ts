import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes, randomInt, randomUUID } from "node:crypto"
import sharp from "sharp"
import {
  currentLegalAcceptance,
  type SessionView,
  type RestaurantAccess,
  type ProfileView,
} from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { defaultMenuSharing } from "@cardapio/domain/menu-sharing"
import { defaultStoreHours } from "@cardapio/domain/store-hours"
import { loadConfig } from "../../src/app/config.js"
import { createApplication } from "../../src/app/bootstrap.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required.")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443",
  password = "M7!qR2@x",
  users: string[] = []
let server: Awaited<ReturnType<typeof createApplication>>
interface Login {
  cookie: string
  csrf: string
  userId: string
  email: string
  store: RestaurantAccess
}
let alice: Login, bob: Login, menu: MenuDocument
function value<T>(response: { body: string }): T {
  const body = JSON.parse(response.body)
  assert.equal(body.ok, true, JSON.stringify(body.error))
  return body.value
}
function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: unknown,
  login?: Login,
) {
  return server.app.inject({
    method,
    url: "/api/v1" + path,
    remoteAddress: `10.87.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    headers: {
      origin,
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
    },
    ...(method === "GET" ? {} : { payload: payload ?? {} }),
  })
}
async function register(label: string) {
  const email = `${label}-${suffix}@example.test`,
    response = await request("POST", "/auth/register", {
      name: "Pessoa Teste",
      email,
      password,
      legalAcceptance: currentLegalAcceptance,
      restaurantName: "Loja Teste",
      slug: `${label}-${suffix}`,
    })
  const session = value<SessionView>(response)
  users.push(session.user.id)
  assert.equal(session.emailVerification, undefined)
  const login: Login = {
    cookie: String(response.headers["set-cookie"]).split(";")[0]!,
    csrf: session.csrfToken,
    userId: session.user.id,
    email,
    store: {} as RestaurantAccess,
  }
  login.store = value<RestaurantAccess[]>(
    await request("GET", "/me/restaurants", undefined, login),
  )[0]!
  return login
}
before(async () => {
  server = await createApplication(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: database,
      SESSION_SECRET: randomBytes(32).toString("hex"),
      CORS_ORIGINS: origin,
      SIGNUP_ENABLED: "true",
      EMAIL_SEND_ENABLED: "false",
      MAIL_PROVIDER: "postal",
      MAIL_API_URL: "not-configured",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      CLOUDFLARE_ORIGIN_SECRET: "",
    }),
  )
  alice = await register("alice-settings")
  bob = await register("bob-settings")
  menu = value<MenuDocument>(
    await request("GET", `/restaurants/${alice.store.id}/menu`, undefined, alice),
  )
})
after(async () => {
  if (!server) return
  await server.runtime.db.transaction(async (tx) => {
    const memberships = await tx.membership.findMany({
        where: { userId: { in: users } },
      }),
      tenantId = { in: memberships.map((m) => m.tenantId) }
    await tx.product.deleteMany({ where: { tenantId } })
    await tx.category.deleteMany({ where: { tenantId } })
    await tx.restaurant.deleteMany({ where: { tenantId } })
    await tx.membership.deleteMany({ where: { userId: { in: users } } })
    await tx.tenant.deleteMany({ where: { id: tenantId } })
    await tx.user.deleteMany({ where: { id: { in: users } } })
  })
  await server.close()
})
test("email-off never queues a challenge, permits overdue accounts and keeps password and CSRF protections", async () => {
  await server.runtime.db.client.user.update({
    where: { id: alice.userId },
    data: { emailVerificationDeadline: new Date(0), emailVerifiedAt: null },
  })
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, alice)).statusCode,
    200,
  )
  assert.equal(
    value<SessionView>(await request("GET", "/auth/session", undefined, alice))
      .emailVerification,
    undefined,
  )
  for (const path of ["/auth/email/send", "/auth/email/confirm"])
    assert.equal((await request("POST", path, { code: "123456" }, alice)).statusCode, 503)
  assert.equal(
    await server.runtime.db.client.emailVerificationChallenge.count({
      where: { userId: alice.userId },
    }),
    0,
  )
  assert.equal(
    value<{ emailSendEnabled: boolean }>(await request("GET", "/configuration"))
      .emailSendEnabled,
    false,
  )
  assert.equal(
    (
      await request("POST", "/auth/login", {
        email: alice.email,
        password: "wrong-password",
      })
    ).statusCode,
    401,
  )
})
test("category CRUD persists, enforces revisions and tenants, and refuses deleting categories with products", async () => {
  const path = `/restaurants/${alice.store.id}/categories`
  assert.equal(
    (
      await request(
        "POST",
        path,
        { expectedRevision: menu.revision, name: "Bebidas" },
        bob,
      )
    ).statusCode,
    404,
  )
  menu = value<MenuDocument>(
    await request(
      "POST",
      path,
      { expectedRevision: menu.revision, name: "Bebidas" },
      alice,
    ),
  )
  const id = menu.categories[0]!.id
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/${id}`,
        { expectedRevision: menu.revision - 1, name: "Sucos" },
        alice,
      )
    ).statusCode,
    409,
  )
  menu = value<MenuDocument>(
    await request(
      "PUT",
      `${path}/${id}`,
      { expectedRevision: menu.revision, name: "Sucos" },
      alice,
    ),
  )
  assert.equal(menu.categories[0]?.name, "Sucos")
  assert.equal(
    (
      await request(
        "POST",
        path,
        { expectedRevision: menu.revision, name: " sÚcos " },
        alice,
      )
    ).statusCode,
    422,
  )
  menu = value<MenuDocument>(
    await request(
      "POST",
      `/restaurants/${alice.store.id}/products`,
      {
        expectedRevision: menu.revision,
        name: "Suco natural",
        description: "",
        price: "9,00",
        imageUrl: "",
        categoryId: id,
        available: true,
        popular: false,
      },
      alice,
    ),
  )
  assert.equal(
    (await request("DELETE", `${path}/${id}`, { expectedRevision: menu.revision }, alice))
      .statusCode,
    422,
  )
  menu = value<MenuDocument>(
    await request(
      "DELETE",
      `/restaurants/${alice.store.id}/products/${menu.products[0]!.id}`,
      { expectedRevision: menu.revision },
      alice,
    ),
  )
  menu = value<MenuDocument>(
    await request("DELETE", `${path}/${id}`, { expectedRevision: menu.revision }, alice),
  )
  assert.equal(menu.categories.length, 0)
  assert.equal(
    value<MenuDocument>(
      await request("GET", `/restaurants/${alice.store.id}/menu`, undefined, alice),
    ).categories.length,
    0,
  )
})
test("address, map and weekly hours persist and clear independently of delivery settings", async () => {
  const settings = {
    name: menu.restaurant.name,
    description: "",
    address: "Rua das Flores, 10 · Centro · São Paulo/SP",
    whatsapp: "",
    logoUrl: "",
    coverUrl: "",
    deliveryFee: "0",
    minOrder: "0",
    eta: "30 min",
    location: { latitude: -23.55, longitude: -46.63 },
  }
  menu = value<MenuDocument>(
    await request(
      "PUT",
      `/restaurants/${alice.store.id}/settings`,
      { ...settings, expectedRevision: menu.revision },
      alice,
    ),
  )
  assert.equal(menu.restaurant.location?.latitude, -23.55)
  const { override: _override, ...defaults } = defaultStoreHours()
  const schedule = {
    ...defaults,
    enabled: true,
    weekly: Array.from({ length: 7 }, () => [{ opensAt: "10:00", closesAt: "23:00" }]),
  }
  menu = value<MenuDocument>(
    await request(
      "PUT",
      `/restaurants/${alice.store.id}/hours`,
      { expectedRevision: menu.revision, schedule },
      alice,
    ),
  )
  const publicMenu = value<MenuDocument>(
    await request("GET", `/public/restaurants/${alice.store.slug}/menu`),
  )
  assert.equal(publicMenu.restaurant.address, settings.address)
  assert.equal(publicMenu.restaurant.hours?.weekly.length, 7)
  menu = value<MenuDocument>(
    await request(
      "PUT",
      `/restaurants/${alice.store.id}/settings`,
      { ...settings, location: null, expectedRevision: menu.revision },
      alice,
    ),
  )
  assert.equal(menu.restaurant.location, null)
})
test("sharing is tenant scoped, rejects damaged and oversized photos, serves escaped metadata and real image sizes", async () => {
  const sharing = {
      ...defaultMenuSharing(),
      title: 'Meu almoço <b> {{env "SECRET"}}',
      description: "Comida fresquinha!",
    },
    path = `/restaurants/${alice.store.id}/sharing`
  assert.equal(
    (await request("PUT", path, { ...sharing, expectedRevision: menu.revision }, bob))
      .statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "PUT",
        path,
        {
          ...sharing,
          squareImage: "data:image/png;base64,iVBORw0KGgo=",
          expectedRevision: menu.revision,
        },
        alice,
      )
    ).statusCode,
    422,
  )
  const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(tooLarge)
  assert.equal(
    (
      await request(
        "PUT",
        path,
        {
          ...sharing,
          squareImage: "data:image/png;base64," + tooLarge.toString("base64"),
          expectedRevision: menu.revision,
        },
        alice,
      )
    ).statusCode,
    422,
  )
  menu = value<MenuDocument>(
    await request("PUT", path, { ...sharing, expectedRevision: menu.revision }, alice),
  )
  const head = await request("GET", `/public/restaurants/${alice.store.slug}/share`)
  assert.match(head.headers["content-type"]!, /text\/html/)
  assert.ok(head.body.includes("&lt;b&gt;") && !head.body.includes("{{"))
  for (const [format, width, height] of [
    ["square", 600, 600],
    ["landscape", 1200, 630],
  ] as const) {
    const response = await request(
      "GET",
      `/public/restaurants/${alice.store.slug}/share-image/${format}.png`,
    )
    assert.equal(response.statusCode, 200)
    const image = await sharp(response.rawPayload).metadata()
    assert.equal(image.width, width)
    assert.equal(image.height, height)
  }
})
test("profile edits persist privately; changing email requires password, rejects duplicates and revokes other sessions", async () => {
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#00aa55" },
  })
    .png()
    .toBuffer()
  const profile = {
    ...value<ProfileView>(await request("GET", "/me/profile", undefined, alice)),
    name: "Novo Nome",
    phone: "11999887766",
    avatarUrl: "data:image/png;base64," + png.toString("base64"),
  }
  assert.equal(
    (await request("PUT", "/me/profile", { ...profile, currentPassword: "" })).statusCode,
    401,
  )
  const saved = value<ProfileView>(
    await request("PUT", "/me/profile", { ...profile, currentPassword: "" }, alice),
  )
  assert.equal(saved.name, "Novo Nome")
  assert.equal(saved.avatarUrl, profile.avatarUrl)
  assert.equal(
    value<ProfileView>(await request("GET", "/me/profile", undefined, bob)).avatarUrl,
    "",
  )
  assert.equal(
    (
      await request(
        "PUT",
        "/me/profile",
        { ...profile, email: bob.email, currentPassword: password },
        alice,
      )
    ).statusCode,
    409,
  )
  const email = `changed-${suffix}@example.test`
  assert.equal(
    (
      await request(
        "PUT",
        "/me/profile",
        { ...profile, email, currentPassword: "wrong-password" },
        alice,
      )
    ).statusCode,
    422,
  )
  const second = await request("POST", "/auth/login", { email: alice.email, password }),
    other = { ...alice, cookie: String(second.headers["set-cookie"]).split(";")[0]! }
  value<ProfileView>(
    await request(
      "PUT",
      "/me/profile",
      { ...profile, email, currentPassword: password },
      alice,
    ),
  )
  assert.equal((await request("GET", "/auth/session", undefined, other)).statusCode, 401)
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, alice)).statusCode,
    200,
  )
  const row = await server.runtime.db.client.user.findUniqueOrThrow({
    where: { id: alice.userId },
  })
  assert.equal(row.emailVerifiedAt, null)
  assert.equal(row.email, email)
})
