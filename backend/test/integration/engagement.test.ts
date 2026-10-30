import { currentLegalAcceptance } from "@cardapio/contracts"
import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt, createECDH, randomBytes } from "node:crypto"
import type {
  ChannelSettings,
  Inbox,
  PreparedOrderView,
  RestaurantAccess,
  Result,
  SessionView,
} from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { createApplication } from "../../src/app/bootstrap.js"
import { loadConfig } from "../../src/app/config.js"
import { NotificationWorker } from "../../src/modules/engagement/infrastructure/notification-worker.js"
import { SubscriptionCipher } from "../../src/modules/engagement/infrastructure/subscription-cipher.js"
import type { WhatsappProvider } from "../../src/modules/engagement/application/ports.js"

const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Requires isolated _test database")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443"
const remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
let server: Awaited<ReturnType<typeof createApplication>>, menu: MenuDocument
let cookie = "",
  csrf = "",
  userId = "",
  store: RestaurantAccess,
  base = ""
const groupId = randomUUID(),
  optionId = randomUUID()
function value<T>(body: string): T {
  const r = JSON.parse(body) as Result<T>
  if (!r.ok) assert.fail(`${r.error.code}: ${r.error.message}`)
  return r.value
}
function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: `/api/v1${url}`,
    remoteAddress,
    headers: {
      origin,
      cookie,
      "x-csrf-token": csrf,
      ...(method !== "GET" ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(method !== "GET" ? { payload: JSON.stringify(payload ?? {}) } : {}),
  })
}
const route = () => `/restaurants/${store.id}`
const publicRoute = () => `/public/restaurants/${store.slug}`
const input = (consent = true) => ({
  expectedRevision: menu.revision,
  cart: {
    restaurantId: store.id,
    lines: [
      {
        productId: menu.products[0]!.id,
        quantity: 2,
        unitPrice: 1011,
        note: "",
        addons: { [optionId]: 1 },
      },
    ],
  },
  details: {
    name: "Cliente reservado",
    phone: "11999999999",
    address: "Rua Particular, 123",
    deliveryAddress: {
      street: "Rua Particular",
      number: "123",
      noNumber: false,
      complement: "",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      postalCode: "",
      reference: "",
      kind: "HOUSE",
    },
    notes: "Dado privado",
    payment: "Pix",
    cashChange: "",
  },
  options: { whatsappConsent: consent },
})
async function order(consent = true) {
  return value<PreparedOrderView>(
    (
      await request("POST", `${publicRoute()}/orders`, input(consent), {
        "idempotency-key": randomUUID(),
      })
    ).body,
  )
}
function pushFixture() {
  const keys = createECDH("prime256v1")
  keys.generateKeys()
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${suffix}`,
    keys: {
      p256dh: keys.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  }
}

before(async () => {
  const vapid = createECDH("prime256v1")
  vapid.generateKeys()
  server = await createApplication(
    loadConfig({
      ...process.env,
      MAIL_PROVIDER: "disabled",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      CLOUDFLARE_ORIGIN_SECRET: "",
      NODE_ENV: "test",
      DATABASE_URL: database,
      CORS_ORIGINS: origin,
      SIGNUP_ENABLED: "true",
      LOG_LEVEL: "silent",
      VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"),
      VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"),
      VAPID_SUBJECT: "mailto:test@example.test",
    }),
  )
  const response = await request("POST", "/auth/register", {
    legalAcceptance: currentLegalAcceptance,
    name: "Gestor Teste",
    email: `engagement-${suffix}@example.test`,
    password: "Fixture-9!mQ",
    restaurantName: "Loja Teste",
    slug: `engagement-${suffix}`,
  })
  const session = value<SessionView>(response.body)
  userId = session.user.id
  csrf = session.csrfToken
  cookie = String(response.headers["set-cookie"]).split(";")[0]!
  store = value<RestaurantAccess[]>((await request("GET", "/me/restaurants")).body)[0]!
  menu = value<MenuDocument>(
    (
      await request("POST", `${route()}/products`, {
        expectedRevision: 0,
        name: "Lanche",
        description: "",
        price: "10,01",
        categoryId: "",
        newCategoryName: "Lanches",
        imageUrl: "",
        available: true,
        popular: false,
      })
    ).body,
  )
  menu = value<MenuDocument>(
    (
      await request("PUT", `${route()}/open`, {
        expectedRevision: menu.revision,
        isOpen: true,
      })
    ).body,
  )
  await server.app.listen(0, "127.0.0.1")
  base = await server.app.getUrl()
})
after(async () => {
  if (!server) return
  try {
    if (store)
      await server.runtime.db.transaction(async (tx) => {
        const tenantId = store.tenantId
        await tx.payment.deleteMany({ where: { tenantId } })
        await tx.order.deleteMany({ where: { tenantId } })
        await tx.storeCommerce.deleteMany({ where: { tenantId } })
        await tx.product.deleteMany({ where: { tenantId } })
        await tx.category.deleteMany({ where: { tenantId } })
        await tx.restaurant.deleteMany({ where: { tenantId } })
        await tx.membership.deleteMany({ where: { tenantId } })
        await tx.tenant.deleteMany({ where: { id: tenantId } })
        await tx.user.deleteMany({ where: { id: userId } })
      })
  } finally {
    await server.close()
  }
})

test("addons use authoritative cents, required choices and optimistic revisions; appearance persists", async () => {
  const group = {
    id: groupId,
    name: "Extras",
    active: true,
    min: 1,
    max: 2,
    productIds: [menu.products[0]!.id],
    options: [
      { id: optionId, name: "Queijo", price: 10, maxQuantity: 2, available: true },
    ],
  }
  menu = value<MenuDocument>(
    (
      await request("PUT", `${route()}/addons`, {
        expectedRevision: menu.revision,
        group,
      })
    ).body,
  )
  assert.equal(
    (
      await request("PUT", `${route()}/addons`, {
        expectedRevision: menu.revision - 1,
        group,
      })
    ).statusCode,
    409,
  )
  const missing = input()
  missing.cart.lines[0]!.addons = {}
  assert.equal(
    (
      await request("POST", `${publicRoute()}/orders`, missing, {
        "idempotency-key": randomUUID(),
      })
    ).statusCode,
    422,
  )
  const underpriced = input()
  underpriced.cart.lines[0]!.unitPrice = 1
  const response = await request("POST", `${publicRoute()}/orders`, underpriced, {
    "idempotency-key": randomUUID(),
  })
  assert.equal(response.statusCode, 409)
  const created = await order()
  const row = await server.runtime.db.client.order.findUniqueOrThrow({
    where: { id: created.orderId! },
  })
  assert.equal(row.subtotal, 2022)
  assert.match(JSON.stringify(row.items), /Queijo/)
  const appearance = {
    preset: "COMPACT",
    color: "PLUM",
    showImages: false,
    headline: "Feito na hora",
  }
  menu = value<MenuDocument>(
    (
      await request("PUT", `${route()}/appearance`, {
        expectedRevision: menu.revision,
        appearance,
      })
    ).body,
  )
  const publicMenu = value<MenuDocument>(
    (await request("GET", `${publicRoute()}/menu`)).body,
  )
  assert.deepEqual(publicMenu.commerce?.appearance, appearance)
  assert.equal(
    (
      await request("DELETE", `${route()}/products/${menu.products[0]!.id}`, {
        expectedRevision: menu.revision,
      })
    ).statusCode,
    422,
  )
})

test("public stream contains only numbers and stages, sends deltas and revokes an active link", async () => {
  let settings = value<ChannelSettings>(
    (await request("GET", `${route()}/channels`)).body,
  )
  assert.equal(
    (
      await request("GET", `${publicRoute()}/board/stream`, undefined, {
        "x-board-key": settings.boardToken,
      })
    ).statusCode,
    404,
  )
  settings = value<ChannelSettings>(
    (
      await request("PUT", `${route()}/channels`, {
        expectedRevision: settings.revision,
        boardEnabled: true,
        whatsappEnabled: false,
      })
    ).body,
  )
  const controller = new AbortController()
  const response = await fetch(`${base}/api/v1${publicRoute()}/board/stream`, {
    headers: { "x-board-key": settings.boardToken },
    signal: controller.signal,
  })
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8")
  const reader = response.body!.getReader(),
    decoder = new TextDecoder()
  let buffer = ""
  async function next(event: string) {
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      for (;;) {
        const boundary = buffer.indexOf("\n\n")
        if (boundary >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          if (frame.startsWith(`event: ${event}\n`))
            return JSON.parse(frame.split("\ndata: ")[1]!) as unknown
        } else {
          const result = await reader.read()
          assert.equal(result.done, false)
          buffer += decoder.decode(result.value, { stream: true })
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  }
  try {
    const initial = await next("snapshot")
    assert.doesNotMatch(
      JSON.stringify(initial),
      /Cliente reservado|11999999999|Rua Particular|customer|items|subtotal|tracking/,
    )
    const created = await order(false)
    const delta = (await next("delta")) as { upsert: { id: string; status: string }[] }
    assert.deepEqual(
      delta.upsert.map((o) => o.id),
      [created.orderId],
    )
    assert.equal(
      (
        await request("PUT", `${route()}/orders/${created.orderId}/status`, {
          expectedRevision: 0,
          status: "PREPARING",
        })
      ).statusCode,
      200,
    )
    const moved = (await next("delta")) as { upsert: { id: string; status: string }[] }
    assert.deepEqual(
      moved.upsert.map((o) => [o.id, o.status]),
      [[created.orderId, "PREPARING"]],
    )
    const rotated = value<ChannelSettings>(
      (
        await request("PUT", `${route()}/channels`, {
          expectedRevision: settings.revision,
          boardEnabled: true,
          whatsappEnabled: false,
          rotateBoard: true,
        })
      ).body,
    )
    assert.notEqual(rotated.boardToken, settings.boardToken)
    await next("unavailable")
    assert.equal((await reader.read()).done, true)
    assert.equal(
      (
        await request("GET", `${publicRoute()}/board/stream`, undefined, {
          "x-board-key": settings.boardToken,
        })
      ).statusCode,
      404,
    )
  } finally {
    controller.abort()
    await reader.cancel().catch(() => {})
  }
})

test("tracking token protects consent; push endpoints are restricted and encrypted, staff subscriptions bind a session", async () => {
  const created = await order(false),
    endpoint = `${publicRoute()}/orders/${created.orderId}/notifications`,
    headers = { "x-order-token": created.trackingToken! }
  assert.equal((await request("GET", endpoint)).statusCode, 404)
  assert.equal(
    value<{ whatsapp: boolean }>(
      (await request("GET", endpoint, undefined, headers)).body,
    ).whatsapp,
    false,
  )
  const enabled = await request("PUT", endpoint, { whatsapp: true }, headers)
  assert.equal(enabled.statusCode, 200)
  assert.deepEqual(JSON.parse(enabled.body), { ok: true })
  assert.equal(
    value<{ whatsapp: boolean }>(
      (await request("GET", endpoint, undefined, headers)).body,
    ).whatsapp,
    true,
  )
  const disabled = await request("PUT", endpoint, { whatsapp: false }, headers)
  assert.equal(disabled.statusCode, 200)
  assert.deepEqual(JSON.parse(disabled.body), { ok: true })
  const subscription = pushFixture()
  for (const bad of [
    "http://127.0.0.1:3001",
    "https://fcm.googleapis.com.evil.test/push",
    "https://fcm.googleapis.com:444/push",
  ])
    assert.equal(
      (await request("POST", `${route()}/push`, { ...subscription, endpoint: bad }))
        .statusCode,
      422,
    )
  assert.equal((await request("POST", `${route()}/push`, subscription)).statusCode, 201)
  assert.equal((await request("POST", `${route()}/push`, subscription)).statusCode, 201)
  const rows = await server.runtime.db.client.pushSubscription.findMany({
    where: { restaurantId: store.id },
  })
  assert.equal(rows.length, 1)
  assert.ok(rows[0]!.sessionId)
  assert.doesNotMatch(rows[0]!.encrypted, /fcm.googleapis|aaaaa|bbbbb/)
  assert.deepEqual(
    new SubscriptionCipher(server.runtime.config.secret).open(rows[0]!.encrypted),
    subscription,
  )
})

test("repeated WhatsApp consent preserves queued event eligibility; reconsent starts a new window", async () => {
  const created = await order(true),
    endpoint = `${publicRoute()}/orders/${created.orderId}/notifications`,
    headers = { "x-order-token": created.trackingToken! },
    firstConsent = new Date(Date.now() - 60000),
    db = server.runtime.db.client
  await db.order.update({
    where: { id: created.orderId! },
    data: { whatsappConsentAt: firstConsent },
  })
  assert.equal(
    (await request("PUT", endpoint, { whatsapp: true }, headers)).statusCode,
    200,
  )
  const unchanged = await db.order.findUniqueOrThrow({
    where: { id: created.orderId! },
    select: { whatsappConsentAt: true, whatsappRevokedAt: true },
  })
  assert.equal(unchanged.whatsappConsentAt?.getTime(), firstConsent.getTime())
  assert.equal(unchanged.whatsappRevokedAt, null)
  assert.equal(
    (await request("PUT", endpoint, { whatsapp: false }, headers)).statusCode,
    200,
  )
  const revoked = await db.order.findUniqueOrThrow({
    where: { id: created.orderId! },
    select: { whatsappRevokedAt: true },
  })
  assert.ok(revoked.whatsappRevokedAt)
  assert.equal(
    (await request("PUT", endpoint, { whatsapp: true }, headers)).statusCode,
    200,
  )
  const renewed = await db.order.findUniqueOrThrow({
    where: { id: created.orderId! },
    select: { whatsappConsentAt: true, whatsappRevokedAt: true },
  })
  assert.ok(renewed.whatsappConsentAt! >= revoked.whatsappRevokedAt)
  assert.notEqual(renewed.whatsappConsentAt?.getTime(), firstConsent.getTime())
  assert.equal(renewed.whatsappRevokedAt, null)
})

test("inbox filters finance by role and read markers never move backward", async () => {
  const created = await order()
  const receipt = {
    requestId: randomUUID(),
    orderId: created.orderId,
    amount: "0,10",
    expectedPaid: 0,
    method: "PIX",
    description: "",
  }
  await request("POST", `${route()}/payments`, receipt)
  await request("POST", `${route()}/payments`, receipt)
  const ownerInbox = value<Inbox>((await request("GET", `${route()}/notifications`)).body)
  assert.equal(
    ownerInbox.items.filter((e) => e.orderId === created.orderId && e.kind === "PAYMENT")
      .length,
    1,
  )
  assert.doesNotMatch(
    JSON.stringify(ownerInbox),
    /Cliente reservado|11999999999|Rua Particular/,
  )
  await server.runtime.db.client.membership.update({
    where: { tenantId_userId: { tenantId: store.tenantId, userId } },
    data: { role: "KITCHEN" },
  })
  try {
    const kitchen = value<Inbox>((await request("GET", `${route()}/notifications`)).body)
    assert.ok(kitchen.items.every((e) => e.kind === "ORDER"))
    assert.equal((await request("GET", `${route()}/channels`)).statusCode, 403)
    const before = new Date().toISOString()
    await request("POST", `${route()}/notifications/read`, { before })
    await request("POST", `${route()}/notifications/read`, {
      before: new Date(0).toISOString(),
    })
    assert.equal(
      value<Inbox>((await request("GET", `${route()}/notifications`)).body).readAt,
      before,
    )
  } finally {
    await server.runtime.db.client.membership.update({
      where: { tenantId_userId: { tenantId: store.tenantId, userId } },
      data: { role: "OWNER" },
    })
  }
})

test("automatic WhatsApp confirms late consent once and groups receipts without manual customer messages", async () => {
  const db = server.runtime.db,
    scope = { tenantId: store.tenantId, restaurantId: store.id }
  await db.client.notificationEvent.updateMany({
    where: scope,
    data: { expandedAt: new Date() },
  })
  await db.client.storeChannel.update({
    where: { restaurantId: store.id },
    data: { whatsappEnabled: true },
  })
  const messages: string[] = []
  const provider: WhatsappProvider = {
    configured: true,
    state: async () => ({ state: "connected", qr: null }),
    connect: async () => ({ state: "connected", qr: null }),
    disconnect: async () => {},
    send: async (_scope, _phone, text) => {
      messages.push(text)
      return "SENT"
    },
  }
  const worker = new NotificationWorker(
    db,
    new SubscriptionCipher(server.runtime.config.secret),
    provider,
    { configured: false, send: async () => "SENT" },
    server.runtime.operation,
  )
  const created = await order(false),
    endpoint = `${publicRoute()}/orders/${created.orderId}/notifications`,
    headers = { "x-order-token": created.trackingToken! }
  await worker.tick()
  assert.equal(messages.length, 0)
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request("PUT", endpoint, { whatsapp: true }, headers)).statusCode,
      200,
    )
  assert.equal(
    await db.client.notificationEvent.count({
      where: { ...scope, orderId: created.orderId!, kind: "SUBSCRIBED" },
    }),
    1,
  )
  await worker.tick()
  assert.equal(messages.length, 1)
  assert.match(messages[0]!, /Avisos automáticos ativados/)
  await request("PUT", endpoint, { whatsapp: false }, headers)
  await request("PUT", endpoint, { whatsapp: true }, headers)
  await worker.tick()
  assert.equal(messages.length, 1)
  assert.ok(
    value<Inbox>((await request("GET", `${route()}/notifications`)).body).items.every(
      (event) => String(event.kind) !== "SUBSCRIBED",
    ),
  )

  await db.client.restaurant.update({
    where: { id: store.id },
    data: { whatsapp: "5511988888888", whatsappConfigured: true },
  })
  const automatic = await order(true)
  const contactText = new URL(automatic.url).searchParams.get("text")!
  assert.match(contactText, /já registrado/)
  assert.match(contactText, /Queijo/)
  assert.match(contactText, /Rua Particular/)
  assert.match(contactText, /Forma de pagamento escolhida/)
  await worker.tick()
  assert.equal(messages.length, 2)
  assert.match(messages[1]!, /Pedido recebido/)
  for (const [revision, status] of ["PREPARING", "READY", "OUT_FOR_DELIVERY"].entries()) {
    // This fixture isolates message policy; status transition authorization is covered separately.
    await db.client.order.update({
      where: { id: automatic.orderId! },
      data: { status: status as "PREPARING" | "READY" | "OUT_FOR_DELIVERY" },
    })
    await db.client.notificationEvent.create({
      data: {
        ...scope,
        id: randomUUID(),
        orderId: automatic.orderId!,
        kind: "ORDER",
        status,
      },
    })
    await worker.tick()
    assert.equal(messages.length, revision === 2 ? 3 : 2)
  }
  assert.match(messages[2]!, /saiu para entrega/)
  for (let i = 0; i < 2; i++) {
    const payment = await request("POST", `${route()}/payments`, {
      requestId: randomUUID(),
      orderId: automatic.orderId,
      amount: "0,10",
      expectedPaid: i * 10,
      method: "PIX",
      description: "",
    })
    assert.equal(payment.statusCode, 201)
  }
  await worker.tick()
  const queued = await db.client.notificationDelivery.findMany({
    where: {
      event: { ...scope, orderId: automatic.orderId!, kind: "PAYMENT" },
      channel: "WHATSAPP",
    },
  })
  assert.equal(queued.length, 2)
  assert.ok(queued.every((job) => job.availableAt > job.createdAt))
  assert.equal(messages.length, 3)
  await db.client.notificationDelivery.updateMany({
    where: { id: { in: queued.map((job) => job.id) } },
    data: { availableAt: new Date(0) },
  })
  await worker.tick()
  assert.equal(messages.length, 4)
  assert.match(messages[3]!, /Saldo a pagar: \*R\$\s20,02\*/)
  assert.equal(
    await db.client.notificationDelivery.count({
      where: { id: { in: queued.map((job) => job.id) }, state: "SKIPPED" },
    }),
    1,
  )
  await worker.close()
})

test("outbox checks consent and session again; ambiguous WhatsApp delivery is never retried", async () => {
  const db = server.runtime.db,
    scope = { tenantId: store.tenantId, restaurantId: store.id }
  // Set up this test's own subscription, independently of preceding assertions.
  await db.client.pushSubscription.deleteMany({ where: scope })
  assert.equal((await request("POST", `${route()}/push`, pushFixture())).statusCode, 201)
  // Bound this fixture to new events; no real network deliveries are made in this test.
  await db.client.notificationEvent.updateMany({
    where: scope,
    data: { expandedAt: new Date() },
  })
  await db.client.storeChannel.update({
    where: { restaurantId: store.id },
    data: { whatsappEnabled: true },
  })
  let sent = 0,
    pushed = 0
  const whatsapp: WhatsappProvider = {
    configured: true,
    state: async () => ({ state: "connected", qr: null }),
    connect: async () => ({ state: "connected", qr: null }),
    disconnect: async () => {},
    send: async () => {
      sent++
      return "UNKNOWN"
    },
  }
  const worker = new NotificationWorker(
    db,
    new SubscriptionCipher(server.runtime.config.secret),
    whatsapp,
    {
      configured: true,
      send: async () => {
        pushed++
        return "EXPIRED"
      },
    },
    server.runtime.operation,
  )
  const created = await order(true)
  await worker.tick()
  await worker.tick()
  const deliveries = await db.client.notificationDelivery.findMany({
    where: { event: { orderId: created.orderId! } },
  })
  assert.equal(deliveries.find((d) => d.channel === "WHATSAPP")?.state, "UNKNOWN")
  assert.equal(sent, 1)
  assert.equal(pushed, 1)
  assert.equal(await db.client.pushSubscription.count({ where: scope }), 0)
  const revoked = await order(true)
  await request(
    "PUT",
    `${publicRoute()}/orders/${revoked.orderId}/notifications`,
    { whatsapp: false },
    { "x-order-token": revoked.trackingToken! },
  )
  await worker.tick()
  assert.equal(sent, 1)
  // Queue a message before revocation, then revoke: dispatch must still skip it.
  const late = await order(true)
  const event = await db.client.notificationEvent.findFirstOrThrow({
    where: { orderId: late.orderId! },
  })
  await db.client.notificationEvent.update({
    where: { id: event.id },
    data: { expandedAt: new Date() },
  })
  await db.client.notificationDelivery.create({
    data: {
      id: randomUUID(),
      eventId: event.id,
      channel: "WHATSAPP",
      recipient: late.orderId!,
    },
  })
  await request(
    "PUT",
    `${publicRoute()}/orders/${late.orderId}/notifications`,
    { whatsapp: false },
    { "x-order-token": late.trackingToken! },
  )
  await worker.tick()
  assert.equal(sent, 1)
  assert.equal(
    (
      await db.client.notificationDelivery.findFirstOrThrow({
        where: { eventId: event.id },
      })
    ).state,
    "SKIPPED",
  )
  // Logout invalidates even a previously queued staff push.
  await request("POST", `${route()}/push`, {
    endpoint: `https://fcm.googleapis.com/fcm/send/logout-${suffix}`,
    keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
  })
  const sub = await db.client.pushSubscription.findFirstOrThrow({ where: scope })
  await db.client.notificationDelivery.create({
    data: { id: randomUUID(), eventId: event.id, channel: "PUSH", recipient: sub.id },
  })
  await request("POST", "/auth/logout")
  await worker.tick()
  assert.equal(pushed, 1)
  await worker.close()
})
