import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt } from "node:crypto"
import { PNG } from "pngjs"
import type {
  PrintingSettings,
  ReceiptDocument,
  RestaurantAccess,
  Result,
  Role,
  SessionView,
} from "@cardapio/contracts"
import { createApplication } from "../../src/app/bootstrap.js"
import { loadConfig } from "../../src/app/config.js"

const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Printing tests require an isolated _test database")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443"
const remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
let server: Awaited<ReturnType<typeof createApplication>>
type Login = { cookie: string; csrf: string; userId: string; store: RestaurantAccess }
let owner: Login, other: Login
const users: string[] = [],
  tenants: string[] = []
let orderId: string, foreignOrderId: string, paymentId: string, standaloneId: string
function value<T>(body: string): T {
  const result = JSON.parse(body) as Result<T>
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`)
  return result.value
}
function request(
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: unknown,
  login?: Login,
  headers: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: `/api/v1${url}`,
    remoteAddress,
    headers: {
      origin,
      ...(method !== "GET" ? { "content-type": "application/json" } : {}),
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
      ...headers,
    },
    ...(method !== "GET" ? { payload: JSON.stringify(payload ?? {}) } : {}),
  })
}
async function register(label: string): Promise<Login> {
  const response = await request("POST", "/auth/register", {
    name: "Operador de testes",
    email: `${label}-${suffix}@example.test`,
    password: "test-123456",
    restaurantName: "Loja de impressão",
    slug: `${label}-${suffix}`,
  })
  const session = value<SessionView>(response.body)
  users.push(session.user.id)
  const login = {
    cookie: String(response.headers["set-cookie"]).split(";")[0]!,
    csrf: session.csrfToken,
    userId: session.user.id,
    store: {} as RestaurantAccess,
  }
  login.store = value<RestaurantAccess[]>(
    (await request("GET", "/me/restaurants", undefined, login)).body,
  )[0]!
  tenants.push(login.store.tenantId)
  return login
}
const route = () => `/restaurants/${owner.store.id}`
const documentRoute = (id = orderId, kind = "ORDER") =>
  `${route()}/orders/${id}/documents/${kind}`
async function seedOrder(login: Login) {
  const id = randomUUID(),
    createdAt = new Date(Date.now() - 60000)
  await server.runtime.db.client.order.create({
    data: {
      id,
      tenantId: login.store.tenantId,
      restaurantId: login.store.id,
      revision: 0,
      status: "READY",
      customer: {
        name: "Cliente restrito",
        phone: "11999999999",
        address: "Rua particular, 18",
        notes: "Portão azul",
        payment: "Pix",
        cashChange: "",
      },
      items: [
        {
          productId: randomUUID(),
          name: "Lanche histórico",
          quantity: 2,
          unitPrice: 501,
          note: "Sem cebola",
          components: ["Queijo"],
        },
      ],
      subtotal: 1002,
      discount: 101,
      deliveryFee: 100,
      total: 1001,
      fulfillment: { mode: "DELIVERY" },
      checkoutRevision: 0,
      whatsappUrl: "",
      idempotencyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      payloadHash: "0".repeat(64),
      createdAt,
    },
  })
  return id
}
async function role<T>(next: Role, action: () => Promise<T>): Promise<T> {
  await server.runtime.db.client.membership.updateMany({
    where: { tenantId: owner.store.tenantId, userId: owner.userId },
    data: { role: next },
  })
  try {
    return await action()
  } finally {
    await server.runtime.db.client.membership.updateMany({
      where: { tenantId: owner.store.tenantId, userId: owner.userId },
      data: { role: "OWNER" },
    })
  }
}
before(async () => {
  server = await createApplication(
    loadConfig({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: database,
      CORS_ORIGINS: origin,
      SIGNUP_ENABLED: "true",
      LOG_LEVEL: "silent",
    }),
  )
  owner = await register("printingowner")
  other = await register("printingother")
  orderId = await seedOrder(owner)
  foreignOrderId = await seedOrder(other)
  for (const linked of [true, false]) {
    const id = randomUUID()
    await server.runtime.db.client.payment.create({
      data: {
        id,
        tenantId: owner.store.tenantId,
        restaurantId: owner.store.id,
        orderId: linked ? orderId : null,
        amount: 30,
        method: "PIX",
        description: linked ? "" : "Venda de balcão",
        recordedBy: owner.userId,
        requestHash: id.replaceAll("-", "").padEnd(64, "0"),
        payloadHash: "0".repeat(64),
        createdAt: new Date(Date.now() - 30000),
      },
    })
    if (linked) paymentId = id
    else standaloneId = id
  }
})
after(async () => {
  if (!server) return
  try {
    await server.runtime.db.transaction(async (tx) => {
      const tenantId = { in: tenants }
      await tx.payment.deleteMany({ where: { tenantId } })
      await tx.order.deleteMany({ where: { tenantId } })
      await tx.storePrinting.deleteMany({ where: { tenantId } })
      await tx.storeCommerce.deleteMany({ where: { tenantId } })
      await tx.product.deleteMany({ where: { tenantId } })
      await tx.category.deleteMany({ where: { tenantId } })
      await tx.restaurant.deleteMany({ where: { tenantId } })
      await tx.membership.deleteMany({ where: { tenantId } })
      await tx.tenant.deleteMany({ where: { id: tenantId } })
      await tx.user.deleteMany({ where: { id: { in: users } } })
    })
  } finally {
    await server.close()
  }
})

test("printing endpoints reject anonymous access, cross-tenant IDs and CSRF-free changes", async () => {
  assert.equal((await request("GET", documentRoute())).statusCode, 401)
  assert.equal((await request("GET", documentRoute(), undefined, other)).statusCode, 404)
  assert.equal(
    (await request("GET", documentRoute(foreignOrderId), undefined, owner)).statusCode,
    404,
  )
  assert.equal(
    (await request("GET", `${route()}/payments/${paymentId}/document`, undefined, other))
      .statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "GET",
        `${route()}/payments/${randomUUID()}/document`,
        undefined,
        owner,
      )
    ).statusCode,
    404,
  )
  assert.equal(
    (
      await request("PUT", `${route()}/printing/settings`, {}, owner, {
        "x-csrf-token": "",
      })
    ).statusCode,
    403,
  )
  assert.equal(
    (await request("GET", documentRoute(orderId, "PAYMENT"), undefined, owner))
      .statusCode,
    422,
  )
})
test("settings are private, revisioned independently and concurrent writes cannot overwrite", async () => {
  const endpoint = `${route()}/printing/settings`
  const settings = value<PrintingSettings>(
    (await request("GET", endpoint, undefined, owner)).body,
  )
  assert.equal(settings.revision, 0)
  const { revision, ...config } = settings
  const responses = await Promise.all([
    request("PUT", endpoint, { ...config, expectedRevision: revision }, owner),
    request("PUT", endpoint, { ...config, expectedRevision: revision }, owner),
  ])
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409])
  assert.equal(
    value<PrintingSettings>((await request("GET", endpoint, undefined, owner)).body)
      .revision,
    1,
  )
  const store = await server.runtime.db.client.restaurant.findUniqueOrThrow({
    where: { id: owner.store.id },
  })
  assert.equal(store.revision, 0)
  const publicMenu = await request("GET", `/public/restaurants/${owner.store.slug}/menu`)
  assert.doesNotMatch(publicMenu.body, /thermal-80|printableWidthMm|templates/)
  await role("CASHIER", async () => {
    assert.equal((await request("GET", endpoint, undefined, owner)).statusCode, 200)
    assert.equal(
      (await request("PUT", endpoint, { ...config, expectedRevision: 1 }, owner))
        .statusCode,
      403,
    )
  })
  await role("MANAGER", async () => {
    assert.equal(
      (await request("PUT", endpoint, { ...config, expectedRevision: 1 }, owner))
        .statusCode,
      200,
    )
  })
})
test("settings reject invalid references, missing required sections, scripts and remote logos", async () => {
  const endpoint = `${route()}/printing/settings`
  const { revision, ...config } = value<PrintingSettings>(
    (await request("GET", endpoint, undefined, owner)).body,
  )
  const patches = [
    { logo: "https://remote.test/logo.png" },
    { logo: "data:image/png;base64,iVBORw0KGgoAAAAA" },
    // Correct dimensions/chunks with an invalid pixel CRC previously passed validation.
    { logo: corruptLogo() },
    { defaults: { ...config.defaults, ORDER: "unknown" } },
    {
      templates: {
        ...config.templates,
        ORDER: {
          blocks: [
            { type: "text", data: { text: "<script>alert(1)</script>", align: "left" } },
          ],
        },
      },
    },
    {
      templates: {
        ...config.templates,
        PAYMENT: { blocks: [{ type: "divider", data: {} }] },
      },
    },
  ]
  for (const patch of patches)
    assert.equal(
      (
        await request(
          "PUT",
          endpoint,
          { ...config, ...patch, expectedRevision: revision },
          owner,
        )
      ).statusCode,
      422,
    )
  assert.equal(
    value<PrintingSettings>((await request("GET", endpoint, undefined, owner)).body)
      .revision,
    revision,
  )
  const persisted = await server.runtime.db.client.storePrinting.findUniqueOrThrow({
    where: { restaurantId: owner.store.id },
  })
  await server.runtime.db.client.storePrinting.update({
    where: { restaurantId: owner.store.id },
    data: { configuration: { broken: true } },
  })
  try {
    const response = await request("GET", endpoint, undefined, owner)
    assert.equal(JSON.parse(response.body).error.code, "CORRUPT_DATA")
    const document = await request("GET", documentRoute(), undefined, owner)
    assert.equal(JSON.parse(document.body).error.code, "CORRUPT_DATA")
  } finally {
    await server.runtime.db.client.storePrinting.update({
      where: { restaurantId: owner.store.id },
      data: { configuration: persisted.configuration! },
    })
  }
})

function corruptLogo() {
  const bytes = PNG.sync.write(new PNG({ width: 1, height: 1 }))
  bytes[bytes.length - 17] = bytes[bytes.length - 17]! ^ 1
  return `data:image/png;base64,${bytes.toString("base64")}`
}
test("documents project exact totals and role privacy, and couriers need current assignment", async () => {
  const doc = value<ReceiptDocument>(
    (await request("GET", documentRoute(), undefined, owner)).body,
  )
  assert.deepEqual(doc.snapshot.totals, {
    subtotal: 1002,
    discount: 101,
    deliveryFee: 100,
    total: 1001,
    paid: 30,
    outstanding: 971,
  })
  await role("KITCHEN", async () => {
    assert.equal(
      (await request("GET", documentRoute(), undefined, owner)).statusCode,
      403,
    )
    assert.equal(
      (
        await request(
          "GET",
          `${route()}/payments/${paymentId}/document`,
          undefined,
          owner,
        )
      ).statusCode,
      403,
    )
    const response = await request(
      "GET",
      documentRoute(orderId, "KITCHEN"),
      undefined,
      owner,
    )
    const kitchen = value<ReceiptDocument>(response.body).snapshot
    assert.equal(kitchen.customer, null)
    assert.equal(kitchen.totals, null)
    assert.equal(kitchen.items[0]!.unitPrice, null)
    assert.doesNotMatch(
      response.body,
      /Cliente restrito|Rua particular|11999999999|Portão azul/,
    )
    assert.match(response.body, /Sem cebola/)
  })
  await role("COURIER", async () => {
    assert.equal(
      (await request("GET", documentRoute(orderId, "DELIVERY"), undefined, owner))
        .statusCode,
      404,
    )
    await server.runtime.db.client.order.update({
      where: { id: orderId },
      data: { courierId: owner.userId },
    })
    assert.equal(
      (await request("GET", documentRoute(orderId, "DELIVERY"), undefined, owner))
        .statusCode,
      200,
    )
    assert.equal(
      (await request("GET", documentRoute(), undefined, owner)).statusCode,
      403,
    )
    await server.runtime.db.client.order.update({
      where: { id: orderId },
      data: { courierId: null },
    })
    assert.equal(
      (await request("GET", documentRoute(orderId, "DELIVERY"), undefined, owner))
        .statusCode,
      404,
    )
  })
  await role("VIEWER", async () =>
    assert.equal(
      (await request("GET", documentRoute(), undefined, owner)).statusCode,
      403,
    ),
  )
})
test("payment documents support standalone receipts and remain coherent during reversal", async () => {
  const standalone = value<ReceiptDocument>(
    (
      await request(
        "GET",
        `${route()}/payments/${standaloneId}/document`,
        undefined,
        owner,
      )
    ).body,
  ).snapshot
  assert.equal(standalone.source.orderId, null)
  assert.equal(standalone.totals, null)
  assert.equal(standalone.payment!.description, "Venda de balcão")
  const endpoint = `${route()}/payments/${paymentId}/document`
  const [receipt, reversal] = await Promise.all([
    request("GET", endpoint, undefined, owner),
    request(
      "POST",
      `${route()}/payments/${paymentId}/reverse`,
      { reason: "Registro duplicado conferido" },
      owner,
    ),
  ])
  assert.equal(reversal.statusCode, 201)
  // A serializable read may be before or after reversal; either must be internally coherent.
  if (receipt.statusCode === 200) {
    const snap = value<ReceiptDocument>(receipt.body).snapshot
    assert.equal(snap.totals!.paid, snap.source.paymentStatus === "VALID" ? 30 : 0)
  } else assert.equal(receipt.statusCode, 409)
  const doc = value<ReceiptDocument>(
    (await request("GET", endpoint, undefined, owner)).body,
  ).snapshot
  assert.equal(doc.source.paymentStatus, "REVERSED")
  assert.equal(doc.payment!.amount, 30)
  assert.equal(doc.payment!.reversalReason, "Registro duplicado conferido")
  assert.equal(doc.totals!.paid, 0)
  assert.equal(doc.totals!.outstanding, 1001)
  await role("CASHIER", async () =>
    assert.equal((await request("GET", endpoint, undefined, owner)).statusCode, 200),
  )
  await server.runtime.db.client.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  })
  const cancelled = value<ReceiptDocument>(
    (await request("GET", documentRoute(), undefined, owner)).body,
  ).snapshot
  assert.equal(cancelled.source.status, "CANCELLED")
  assert.equal(cancelled.totals!.outstanding, 0)
  await server.runtime.db.client.order.update({
    where: { id: orderId },
    data: {
      items: [
        {
          productId: randomUUID(),
          name: "Lanche inconsistente",
          quantity: 2,
          unitPrice: 502,
          note: "",
        },
      ],
    },
  })
  const invalid = await request("GET", documentRoute(), undefined, owner)
  assert.equal(JSON.parse(invalid.body).error.code, "CORRUPT_DATA")
})
