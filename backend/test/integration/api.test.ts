import { PrismaMenu } from "../../src/modules/catalog/infrastructure/prisma-menu.js"
import { Database } from "../../src/shared/infrastructure/database.js"
import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt } from "node:crypto"
type HTTPMethods = "GET" | "POST" | "PUT" | "DELETE"
import type { RestaurantAccess, SessionView, Result } from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { loadConfig } from "../../src/app/config.js"
import { createApplication } from "../../src/app/bootstrap.js"

const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Tests require TEST_DATABASE_URL ending in _test.")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443"
let remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
let server: Awaited<ReturnType<typeof createApplication>>
interface Login {
  cookie: string
  csrf: string
  userId: string
  store: RestaurantAccess
  email: string
}
let alice: Login, bob: Login
let menu: MenuDocument
const password = "12345678"
const registrations: string[] = []
function value<T>(body: string): T {
  const result = JSON.parse(body) as Result<T>
  if (!result.ok) assert.fail(result.error.code)
  return result.value
}
function code(body: string) {
  const result = JSON.parse(body)
  assert.equal(result.ok, false)
  assert.equal(typeof result.error.diagnosticId, "string")
  return result.error.code
}
function request(
  method: HTTPMethods,
  url: string,
  payload?: unknown,
  login?: Login,
  extra: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: `/api/v1${url}`,
    remoteAddress,
    headers: {
      origin,
      ...(method !== "GET" ? { "content-type": "application/json" } : {}),
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
      ...extra,
    },
    ...(method !== "GET" ? { payload: JSON.stringify(payload ?? {}) } : {}),
  })
}
async function register(label: string): Promise<Login> {
  const email = `${label}-${suffix}@example.test`
  const response = await request("POST", "/auth/register", {
    name: label,
    email,
    password,
    restaurantName: `Loja ${label}`,
    slug: `${label}-${suffix}`,
  })
  assert.equal(response.statusCode, 201)
  const session = value<SessionView>(response.body)
  registrations.push(session.user.id)
  const cookie = String(response.headers["set-cookie"]).split(";")[0]!
  assert.match(String(response.headers["set-cookie"]), /HttpOnly/)
  assert.match(String(response.headers["set-cookie"]), /SameSite=Lax/)
  const login = {
    cookie,
    csrf: session.csrfToken,
    userId: session.user.id,
    email,
    store: {} as RestaurantAccess,
  }
  login.store = value<RestaurantAccess[]>(
    (await request("GET", "/me/restaurants", undefined, login)).body,
  )[0]!
  return login
}
async function current() {
  menu = value<MenuDocument>(
    (await request("GET", `/restaurants/${alice.store.id}/menu`, undefined, alice)).body,
  )
  return menu
}
async function setOpen(isOpen: boolean) {
  await current()
  menu = value<MenuDocument>(
    (
      await request(
        "PUT",
        `/restaurants/${alice.store.id}/open`,
        { expectedRevision: menu.revision, isOpen },
        alice,
      )
    ).body,
  )
}
function checkout() {
  return {
    expectedRevision: menu.revision,
    cart: {
      restaurantId: alice.store.id,
      lines: [
        {
          productId: menu.products[0]!.id,
          quantity: 1,
          unitPrice: menu.products[0]!.price,
          note: "Sem cebola",
        },
      ],
    },
    details: {
      name: "Cliente de teste",
      phone: "11999999999",
      address: "Rua de teste, 10",
      notes: "",
      payment: "Pix",
      cashChange: "",
    },
  }
}
before(async () => {
  server = await createApplication(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: database,
      SIGNUP_ENABLED: "true",
      CORS_ORIGINS: origin,
    }),
  )
  alice = await register("alice")
  bob = await register("bob")
})
after(async () => {
  if (!server) return
  // Delete only this run's generated accounts and their stores; never truncate shared data.
  await server.runtime.db.transaction(async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { userId: { in: registrations }, role: "OWNER" },
      select: { tenantId: true },
    })
    const tenantId = { in: memberships.map((row) => row.tenantId) }
    await tx.payment.deleteMany({ where: { tenantId } })
    await tx.order.deleteMany({ where: { tenantId } })
    await tx.storeCommerce.deleteMany({ where: { tenantId } })
    await tx.product.deleteMany({ where: { tenantId } })
    await tx.category.deleteMany({ where: { tenantId } })
    await tx.restaurant.deleteMany({ where: { tenantId } })
    await tx.membership.deleteMany({ where: { tenantId } })
    await tx.tenant.deleteMany({ where: { id: tenantId } })
    await tx.user.deleteMany({ where: { id: { in: registrations } } })
  })
  await server.close()
})
test("real MySQL migrations, hashed credentials and empty closed stores", async () => {
  assert.equal((await request("GET", "/health/ready")).statusCode, 200)
  await current()
  assert.equal(menu.products.length, 0)
  assert.equal(menu.categories.length, 0)
  assert.equal(menu.restaurant.isOpen, false)
  const user = await server.runtime.db.client.user.findUniqueOrThrow({
    where: { id: alice.userId },
  })
  assert.match(user.passwordHash, /^\$argon2id\$/)
  const sessions = await server.runtime.db.client.session.findMany({
    where: { userId: alice.userId },
  })
  assert.equal(sessions.length, 1)
  assert.match(sessions[0]!.tokenHash, /^[a-f0-9]{64}$/)
})
test("private routes, origins, CSRF and malformed JSON fail closed", async () => {
  assert.equal((await request("GET", "/me/restaurants")).statusCode, 401)
  assert.equal(
    (
      await request("POST", "/auth/login", {}, undefined, {
        origin: "https://evil.example",
      })
    ).statusCode,
    403,
  )
  const absent = await server.app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: {},
    remoteAddress,
  })
  assert.equal(absent.statusCode, 403)
  const missingCsrf = await request(
    "PUT",
    `/restaurants/${alice.store.id}/open`,
    { expectedRevision: 0, isOpen: true },
    alice,
    { "x-csrf-token": "" },
  )
  assert.equal(code(missingCsrf.body), "CSRF_INVALID")
  const malformed = await server.app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: "{",
    remoteAddress,
    headers: { origin, "content-type": "application/json" },
  })
  assert.equal(code(malformed.body), "VALIDATION")
  assert.doesNotMatch(malformed.body, /SyntaxError|stack|node_modules/)
  const oversized = await request("POST", "/auth/login", { email: "x".repeat(33 * 1024) })
  assert.equal(code(oversized.body), "VALIDATION")
  assert.equal(oversized.statusCode, 422)
  assert.doesNotMatch(oversized.body, /FST_ERR|stack|node_modules/)
})
test("tenant identifiers cannot select another customer's resources", async () => {
  assert.equal(
    (await request("GET", `/restaurants/${alice.store.id}/menu`, undefined, bob))
      .statusCode,
    404,
  )
  assert.equal(
    (await request("GET", `/restaurants/${alice.store.id}/orders`, undefined, bob))
      .statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/restaurants/${alice.store.id}/open`,
        { expectedRevision: 0, isOpen: true },
        bob,
      )
    ).statusCode,
    404,
  )
  const own = value<RestaurantAccess[]>(
    (await request("GET", "/me/restaurants", undefined, bob)).body,
  )
  assert.equal(own.length, 1)
  assert.equal(own[0]!.id, bob.store.id)
  assert.equal(
    (await request("GET", "/public/restaurants/unknown-store/menu")).statusCode,
    404,
  )
})
test("invalid product rolls back its new category; valid decimal becomes cents", async () => {
  const input = {
    expectedRevision: 0,
    name: "Açaí com paçoca",
    description: "Porção especial",
    price: "1,23abc",
    categoryId: "",
    newCategoryName: "Porções",
    imageUrl: "",
    available: true,
    popular: true,
  }
  assert.equal(
    code(
      (await request("POST", `/restaurants/${alice.store.id}/products`, input, alice))
        .body,
    ),
    "VALIDATION",
  )
  await current()
  assert.equal(menu.categories.length, 0)
  assert.equal(menu.revision, 0)
  menu = value<MenuDocument>(
    (
      await request(
        "POST",
        `/restaurants/${alice.store.id}/products`,
        { ...input, price: "28.90" },
        alice,
      )
    ).body,
  )
  assert.equal(menu.products[0]!.price, 2890)
  assert.equal(menu.products[0]!.name, "Açaí com paçoca")
  assert.equal(menu.categories.length, 1)
  assert.equal(
    code(
      (
        await request(
          "POST",
          `/restaurants/${alice.store.id}/products`,
          {
            ...input,
            expectedRevision: menu.revision,
            newCategoryName: "porcoes",
            price: "1",
          },
          alice,
        )
      ).body,
    ),
    "VALIDATION",
  )
  const foreign = value<MenuDocument>(
    (await request("GET", `/restaurants/${bob.store.id}/menu`, undefined, bob)).body,
  )
  assert.equal(foreign.products.length, 0)
})
test("concurrent revisions produce one success and one conflict", async () => {
  await current()
  const responses = await Promise.all(
    [true, false].map((isOpen) =>
      request(
        "PUT",
        `/restaurants/${alice.store.id}/open`,
        { expectedRevision: menu.revision, isOpen },
        alice,
      ),
    ),
  )
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409])
  const revision = menu.revision
  await current()
  assert.equal(menu.revision, revision + 1)
})
test("settings are persisted; checkout rejects closed, empty, stale, foreign or invalid delivery", async () => {
  await current()
  menu = value<MenuDocument>(
    (
      await request(
        "PUT",
        `/restaurants/${alice.store.id}/settings`,
        {
          expectedRevision: menu.revision,
          name: "Loja São José",
          description: "Descrição",
          whatsapp: "11988888888",
          address: "Endereço",
          logoUrl: "",
          coverUrl: "",
          deliveryFee: "5,00",
          minOrder: "10,00",
          eta: "30 minutos",
        },
        alice,
      )
    ).body,
  )
  await setOpen(false)
  const endpoint = `/public/restaurants/${alice.store.slug}/orders`
  assert.equal(
    code(
      (
        await request("POST", endpoint, checkout(), undefined, {
          "idempotency-key": randomUUID(),
        })
      ).body,
    ),
    "VALIDATION",
  )
  await setOpen(true)
  const base = checkout()
  const invalids = [
    { ...base, cart: { ...base.cart, lines: [] } },
    { ...base, cart: { ...base.cart, restaurantId: bob.store.id } },
    { ...base, cart: { ...base.cart, lines: [{ ...base.cart.lines[0], unitPrice: 1 }] } },
    {
      ...base,
      cart: { ...base.cart, lines: [{ ...base.cart.lines[0], productId: randomUUID() }] },
    },
    {
      ...base,
      cart: { ...base.cart, lines: [{ ...base.cart.lines[0], quantity: 1.5 }] },
    },
    { ...base, details: { ...base.details, phone: "123" } },
    { ...base, details: { ...base.details, payment: "Dinheiro", cashChange: "1,00" } },
    { ...base, expectedRevision: 0 },
  ]
  for (const input of invalids) {
    const response = await request("POST", endpoint, input, undefined, {
      "idempotency-key": randomUUID(),
    })
    assert.ok([409, 422].includes(response.statusCode))
  }
  assert.equal(
    await server.runtime.db.client.order.count({
      where: { restaurantId: alice.store.id },
    }),
    0,
  )
})
test("orders are idempotent, tenant scoped and advance only through valid stages", async () => {
  await current()
  const input = checkout(),
    key = randomUUID(),
    endpoint = `/public/restaurants/${alice.store.slug}/orders`
  const created = value<{ orderId: string; url: string }>(
    (await request("POST", endpoint, input, undefined, { "idempotency-key": key })).body,
  )
  const replay = value<{ orderId: string }>(
    (await request("POST", endpoint, input, undefined, { "idempotency-key": key })).body,
  )
  assert.equal(created.orderId, replay.orderId)
  assert.match(created.url, /^https:\/\/wa\.me\/5511988888888/)
  const conflict = await request(
    "POST",
    endpoint,
    { ...input, details: { ...input.details, notes: "Outro pedido" } },
    undefined,
    { "idempotency-key": key },
  )
  assert.equal(code(conflict.body), "CONFLICT")
  assert.equal(
    await server.runtime.db.client.order.count({
      where: { restaurantId: alice.store.id },
    }),
    1,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/restaurants/${bob.store.id}/orders/${created.orderId}/status`,
        { expectedRevision: 0, status: "PREPARING" },
        bob,
      )
    ).statusCode,
    404,
  )
  const target = `/restaurants/${alice.store.id}/orders/${created.orderId}/status`
  assert.equal(
    code(
      (await request("PUT", target, { expectedRevision: 0, status: "COMPLETED" }, alice))
        .body,
    ),
    "CONFLICT",
  )
  for (const [revision, status] of [
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
  ].entries())
    assert.equal(
      (await request("PUT", target, { expectedRevision: revision, status }, alice))
        .statusCode,
      200,
    )
  const page = value<{ items: { status: string; total: number }[] }>(
    (await request("GET", `/restaurants/${alice.store.id}/orders`, undefined, alice))
      .body,
  )
  assert.equal(page.items[0]!.status, "COMPLETED")
  assert.equal(page.items[0]!.total, 3390)
})
test("membership roles and revocation are enforced in application services", async () => {
  assert.equal(
    (
      await request(
        "POST",
        `/tenants/${alice.store.tenantId}/members`,
        { email: bob.email, role: "STAFF" },
        alice,
      )
    ).statusCode,
    201,
  )
  assert.equal(
    (await request("GET", `/restaurants/${alice.store.id}/menu`, undefined, bob))
      .statusCode,
    200,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `/restaurants/${alice.store.id}/open`,
        { expectedRevision: menu.revision, isOpen: false },
        bob,
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request(
        "DELETE",
        `/tenants/${alice.store.tenantId}/members/${bob.userId}`,
        {},
        alice,
      )
    ).statusCode,
    200,
  )
  const session = await server.runtime.auth.authenticate(bob.cookie.split("=")[1])
  const result = await server.runtime.catalog.adminMenu(session.actor, alice.store.id)
  assert.equal(result.ok, false)
})
test("shared Redis rate limit persists and authorization outage has no fallback", async () => {
  const key = `test:${randomUUID()}`
  await server.runtime.limiter.consume(key, 1, 60)
  await assert.rejects(
    () => server.runtime.limiter.consume(key, 1, 60),
    (error) => error instanceof Error && "code" in error && error.code === "RATE_LIMITED",
  )
  const result = await server.runtime.catalog.adminMenu(
    { userId: randomUUID(), sessionId: randomUUID() },
    alice.store.id,
  )
  assert.equal(result.ok, false)
})
test("a database failure during a composite write rolls back the revision and category", async () => {
  const bobMenu = value<MenuDocument>(
    (
      await request(
        "POST",
        `/restaurants/${bob.store.id}/products`,
        {
          expectedRevision: 0,
          name: "Outro produto",
          description: "",
          price: "10",
          categoryId: "",
          newCategoryName: "Outra categoria",
          imageUrl: "",
          available: true,
          popular: false,
        },
        bob,
      )
    ).body,
  )
  await current()
  const categoryId = randomUUID()
  const next = {
    ...menu,
    categories: [
      ...menu.categories,
      { id: categoryId, restaurantId: alice.store.id, name: "Não deve persistir" },
    ],
    products: [
      ...menu.products,
      { ...bobMenu.products[0]!, restaurantId: alice.store.id, categoryId },
    ],
  }
  const before = menu.revision
  const repository = new PrismaMenu(server.runtime.db)
  await assert.rejects(() =>
    repository.commit(
      { tenantId: alice.store.tenantId, restaurantId: alice.store.id },
      before,
      next,
    ),
  )
  await current()
  assert.equal(menu.revision, before)
  assert.equal(
    menu.categories.some((category) => category.id === categoryId),
    false,
  )
})
test("unavailable MySQL cannot initialize an alternative repository", async () => {
  const target = new URL(database!)
  target.port = "1"
  const unavailable = new Database(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: target.href,
      CORS_ORIGINS: origin,
    }),
  )
  try {
    await assert.rejects(
      () => unavailable.connect(),
      (error) =>
        error instanceof Error && "code" in error && error.code === "STORAGE_UNAVAILABLE",
    )
  } finally {
    await unavailable.close()
  }
})

test("combos, regional fees, promotion caps and snapshots are transactional", async () => {
  remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
  await current()
  const comboId = randomUUID(),
    groupId = randomUUID(),
    zoneId = randomUUID(),
    promoId = randomUUID(),
    productId = menu.products[0]!.id
  const mutate = async (suffix: string, data: object) => {
    const response = await request(
      "PUT",
      `/restaurants/${alice.store.id}/${suffix}`,
      { expectedRevision: menu.revision, ...data },
      alice,
    )
    assert.equal(response.statusCode, 200, response.body)
    menu = value<MenuDocument>(response.body)
  }
  const combo = {
    id: comboId,
    name: "Combo São José",
    description: "Dois favoritos",
    price: 4000,
    imageUrl: "",
    active: true,
    items: [{ productId, quantity: 1 }],
    groups: [{ id: groupId, name: "Escolha", options: [{ productId, extraPrice: 500 }] }],
  }
  await mutate("combos", { combo })
  const remove = await request(
    "DELETE",
    `/restaurants/${alice.store.id}/products/${productId}`,
    { expectedRevision: menu.revision },
    alice,
  )
  assert.equal(code(remove.body), "VALIDATION")
  const foreignCombo = await request(
    "PUT",
    `/restaurants/${bob.store.id}/combos`,
    { expectedRevision: 1, combo },
    bob,
  )
  assert.equal(code(foreignCombo.body), "VALIDATION")
  await mutate("delivery", {
    delivery: {
      enabled: true,
      pickupEnabled: true,
      mode: "ZONES",
      pickupEta: "20 minutos",
      zones: [
        {
          id: zoneId,
          state: "SP",
          city: "São Paulo",
          neighborhood: "Centro",
          fee: 900,
          etaMin: 30,
          etaMax: 45,
          active: true,
          latitude: null,
          longitude: null,
        },
      ],
    },
  })
  const promotion = {
    id: promoId,
    name: "Oferta limitada",
    code: "",
    kind: "PERCENT",
    value: 10,
    minSubtotal: 0,
    maxDiscount: 0,
    includeCombos: true,
    active: true,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    maxUses: 1,
  }
  await mutate("promotions", { promotion })
  const base = checkout(),
    input = {
      ...base,
      cart: {
        restaurantId: alice.store.id,
        lines: [
          {
            productId: comboId,
            kind: "COMBO",
            quantity: 1,
            unitPrice: 4500,
            selections: { [groupId]: productId },
            note: "Sem gelo",
          },
        ],
      },
      options: { fulfillment: { mode: "DELIVERY", zoneId }, expectedTotal: 4950 },
    }
  const publicBase = `/public/restaurants/${alice.store.slug}`
  const quoted = value<{ total: number; discount: number; deliveryFee: number }>(
    (
      await request("POST", `${publicBase}/checkout/quote`, {
        expectedRevision: menu.revision,
        cart: input.cart,
        options: { fulfillment: { mode: "DELIVERY", zoneId } },
      })
    ).body,
  )
  assert.deepEqual([quoted.total, quoted.discount, quoted.deliveryFee], [4950, 450, 900])
  const outputs = await Promise.all(
    [1, 2].map(() =>
      request("POST", `${publicBase}/orders`, input, undefined, {
        "idempotency-key": randomUUID(),
      }),
    ),
  )
  assert.deepEqual(outputs.map((r) => r.statusCode).sort(), [201, 409])
  const created = value<{ orderId: string; trackingToken: string }>(
    outputs.find((r) => r.statusCode === 201)!.body,
  )
  await current()
  assert.equal(menu.commerce!.promotions[0]!.used, 1)
  // A concurrent catalog update cannot reset the promotion counter.
  await mutate("promotions", { promotion: { ...promotion, name: "Oferta já usada" } })
  assert.equal(menu.commerce!.promotions[0]!.used, 1)
  const record = await server.runtime.db.client.order.findUniqueOrThrow({
    where: { id: created.orderId },
  })
  assert.equal(record.total, 4950)
  assert.equal(record.discount, 450)
  assert.notEqual(record.trackingHash, created.trackingToken)
  const tracked = await request(
    "GET",
    `${publicBase}/orders/${created.orderId}`,
    undefined,
    undefined,
    { "x-order-token": created.trackingToken },
  )
  assert.equal(tracked.statusCode, 200)
  assert.doesNotMatch(
    tracked.body,
    /Cliente de teste|11999999999|Rua de teste|Sem gelo|trackingHash/,
  )
  assert.match(tracked.body, /Combo São José/)
  assert.equal(
    (await request("GET", `${publicBase}/orders/${created.orderId}`)).statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "GET",
        `/public/restaurants/${bob.store.slug}/orders/${created.orderId}`,
        undefined,
        undefined,
        { "x-order-token": created.trackingToken },
      )
    ).statusCode,
    404,
  )
  const invalid = await request(
    "POST",
    `${publicBase}/orders`,
    {
      ...input,
      expectedRevision: menu.revision,
      options: { fulfillment: { mode: "DELIVERY", zoneId: randomUUID() } },
    },
    undefined,
    { "idempotency-key": randomUUID() },
  )
  assert.equal(code(invalid.body), "VALIDATION")
  const pickup = {
    ...input,
    expectedRevision: menu.revision,
    details: { ...base.details, address: "" },
    options: { fulfillment: { mode: "PICKUP" }, expectedTotal: 4500 },
  }
  const pickupReceipt = value<{ orderId: string }>(
    (
      await request("POST", `${publicBase}/orders`, pickup, undefined, {
        "idempotency-key": randomUUID(),
      })
    ).body,
  )
  for (const [expectedRevision, status] of ["PREPARING", "READY", "COMPLETED"].entries())
    assert.equal(
      (
        await request(
          "PUT",
          `/restaurants/${alice.store.id}/orders/${pickupReceipt.orderId}/status`,
          { expectedRevision, status },
          alice,
        )
      ).statusCode,
      200,
    )
  // Stable idempotency includes the tracking credential.
  const key = randomUUID(),
    receipt1 = await request("POST", `${publicBase}/orders`, pickup, undefined, {
      "idempotency-key": key,
    }),
    receipt2 = await request("POST", `${publicBase}/orders`, pickup, undefined, {
      "idempotency-key": key,
    })
  assert.deepEqual(JSON.parse(receipt1.body), JSON.parse(receipt2.body))
})

test("kitchen, courier and viewer permissions restrict data and order transitions", async () => {
  const makeMember = async (role: string) => {
    const response = await request(
      "POST",
      `/tenants/${alice.store.tenantId}/members`,
      { email: bob.email, role },
      alice,
    )
    assert.equal(response.statusCode, 201)
  }
  await makeMember("KITCHEN")
  const path = `/restaurants/${alice.store.id}`
  const kitchen = value<{ items: import("@cardapio/contracts").OrderView[] }>(
    (await request("GET", `${path}/orders`, undefined, bob)).body,
  )
  assert.ok(kitchen.items.length > 0)
  assert.ok(
    kitchen.items.every(
      (o) => o.customer.phone === "" && o.customer.address === "Dados restritos",
    ),
  )
  const active = kitchen.items.find(
    (o) => o.status === "NEW" && o.fulfillment?.mode === "DELIVERY",
  )!
  assert.ok(active)
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: active.revision, status: "CANCELLED" },
        bob,
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: active.revision, status: "PREPARING" },
        bob,
      )
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: active.revision + 1, status: "READY" },
        bob,
      )
    ).statusCode,
    200,
  )
  await makeMember("COURIER")
  assert.equal(
    value<{ items: unknown[] }>(
      (await request("GET", `${path}/orders`, undefined, bob)).body,
    ).items.length,
    0,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: 2, status: "OUT_FOR_DELIVERY" },
        bob,
      )
    ).statusCode,
    404,
  )
  const assigned = value<{ revision: number }>(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/courier`,
        { expectedRevision: 2, courierId: bob.userId },
        alice,
      )
    ).body,
  )
  assert.equal(
    value<{ items: unknown[] }>(
      (await request("GET", `${path}/orders`, undefined, bob)).body,
    ).items.length,
    1,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: assigned.revision, status: "OUT_FOR_DELIVERY" },
        bob,
      )
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: assigned.revision + 1, status: "COMPLETED" },
        bob,
      )
    ).statusCode,
    200,
  )
  await makeMember("VIEWER")
  assert.equal(
    (
      await request(
        "PUT",
        `${path}/orders/${active.id}/status`,
        { expectedRevision: 99, status: "PREPARING" },
        bob,
      )
    ).statusCode,
    403,
  )
  assert.equal((await request("PUT", `${path}/delivery`, {}, bob)).statusCode, 422)
  assert.equal(
    (await request("GET", `/tenants/${alice.store.tenantId}/members`, undefined, bob))
      .statusCode,
    403,
  )
  await request(
    "DELETE",
    `/tenants/${alice.store.tenantId}/members/${bob.userId}`,
    {},
    alice,
  )
  assert.equal((await request("GET", `${path}/orders`, undefined, bob)).statusCode, 404)
})

test("team signup creates no tenant and still requires an owner to grant access", async () => {
  remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
  const email = `team-${suffix}@example.test`,
    response = await request("POST", "/auth/register-account", {
      name: "Equipe",
      email,
      password,
    })
  assert.equal(response.statusCode, 201)
  const session = value<SessionView>(response.body)
  registrations.push(session.user.id)
  const cookie = String(response.headers["set-cookie"]).split(";")[0]!
  assert.equal(
    await server.runtime.db.client.membership.count({
      where: { userId: session.user.id },
    }),
    0,
  )
  assert.equal(
    value<unknown[]>(
      (
        await request("GET", "/me/restaurants", undefined, {
          cookie,
          csrf: session.csrfToken,
          userId: session.user.id,
          email,
          store: alice.store,
        })
      ).body,
    ).length,
    0,
  )
  assert.equal(
    (
      await request(
        "POST",
        `/tenants/${alice.store.tenantId}/members`,
        { email, role: "CASHIER" },
        alice,
      )
    ).statusCode,
    201,
  )
})

test("password change revokes all sessions and logout cannot be replayed", async () => {
  const login = await request("POST", "/auth/login", { email: bob.email, password })
  assert.equal(login.statusCode, 201)
  assert.equal(
    (
      await request(
        "PUT",
        "/auth/password",
        { currentPassword: password, newPassword: "another8" },
        bob,
      )
    ).statusCode,
    200,
  )
  assert.equal((await request("GET", "/auth/session", undefined, bob)).statusCode, 401)
  const secondCookie = String(login.headers["set-cookie"]).split(";")[0]!
  assert.equal(
    (await request("GET", "/auth/session", undefined, { ...bob, cookie: secondCookie }))
      .statusCode,
    401,
  )
  assert.equal((await request("POST", "/auth/logout", {}, alice)).statusCode, 201)
  assert.equal((await request("GET", "/auth/session", undefined, alice)).statusCode, 401)
})
