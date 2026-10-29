import { currentLegalAcceptance } from "@cardapio/contracts"
import { before, after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt } from "node:crypto"
import type {
  FinancialReport,
  OrderBalance,
  PaymentPage,
  PaymentView,
  PreparedOrderView,
  RestaurantAccess,
  Result,
  Role,
  SessionView,
} from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { createApplication } from "../../src/app/bootstrap.js"
import { loadConfig } from "../../src/app/config.js"

const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Payment tests require an isolated _test database")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443"
const remoteAddress = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
let server: Awaited<ReturnType<typeof createApplication>>
type Login = { cookie: string; csrf: string; userId: string; store: RestaurantAccess }
let owner: Login, other: Login, menu: MenuDocument
const users: string[] = []
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
    legalAcceptance: currentLegalAcceptance,
    name: label,
    email: `${label}-${suffix}@example.test`,
    password: "test-123456",
    restaurantName: "Financeiro teste",
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
  return login
}
const route = () => `/restaurants/${owner.store.id}`
const range = () =>
  new URLSearchParams({
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date(Date.now() + 86400000).toISOString(),
  }).toString()
async function order() {
  const response = await request(
    "POST",
    `/public/restaurants/${owner.store.slug}/orders`,
    {
      expectedRevision: menu.revision,
      cart: {
        restaurantId: owner.store.id,
        lines: [
          { productId: menu.products[0]!.id, quantity: 1, unitPrice: 1001, note: "" },
        ],
      },
      details: {
        name: "Cliente de teste",
        phone: "11999999999",
        address: "Rua de teste, 1",
        deliveryAddress: {
          street: "Rua de teste",
          number: "1",
          noNumber: false,
          complement: "",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "",
          reference: "",
          kind: "HOUSE",
        },
        notes: "",
        payment: "Pix",
        cashChange: "",
      },
    },
    undefined,
    { "idempotency-key": randomUUID() },
  )
  return value<PreparedOrderView>(response.body).orderId!
}
const command = (orderId: string | null, amount = "10,01", expectedPaid = 0) => ({
  requestId: randomUUID(),
  orderId,
  amount,
  expectedPaid,
  method: "PIX",
  description: orderId ? "" : "Venda avulsa de teste",
})
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
  owner = await register("financeowner")
  other = await register("financeother")
  menu = value<MenuDocument>(
    (
      await request(
        "POST",
        `${route()}/products`,
        {
          expectedRevision: 0,
          name: "Lanche de teste",
          description: "",
          price: "10,01",
          categoryId: "",
          newCategoryName: "Lanches",
          imageUrl: "",
          available: true,
          popular: false,
        },
        owner,
      )
    ).body,
  )
  menu = value<MenuDocument>(
    (
      await request(
        "PUT",
        `${route()}/open`,
        { expectedRevision: menu.revision, isOpen: true },
        owner,
      )
    ).body,
  )
})
after(async () => {
  if (!server) return
  try {
    await server.runtime.db.transaction(async (tx) => {
      const owners = await tx.membership.findMany({
        where: { userId: { in: users }, role: "OWNER" },
        select: { tenantId: true },
      })
      const tenantId = { in: owners.map((m) => m.tenantId) }
      await tx.payment.deleteMany({ where: { tenantId } })
      await tx.order.deleteMany({ where: { tenantId } })
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

test("payment routes require session, CSRF and tenant isolation", async () => {
  assert.equal((await request("GET", `${route()}/payments?${range()}`)).statusCode, 401)
  assert.equal(
    (
      await request("POST", `${route()}/payments`, command(null), owner, {
        "x-csrf-token": "",
      })
    ).statusCode,
    403,
  )
  assert.equal(
    (await request("GET", `${route()}/reports/financial?${range()}`, undefined, other))
      .statusCode,
    404,
  )
  const foreignOrder = randomUUID()
  assert.equal(
    (await request("POST", `${route()}/payments`, command(foreignOrder), owner))
      .statusCode,
    404,
  )
})
test("same request is idempotent, amounts are exact, overpayment and stale writes are rejected", async () => {
  const id = await order(),
    input = command(id, "0,10")
  const first = value<PaymentView>(
    (await request("POST", `${route()}/payments`, input, owner)).body,
  )
  const retry = value<PaymentView>(
    (await request("POST", `${route()}/payments`, input, owner)).body,
  )
  assert.equal(first.id, retry.id)
  assert.equal(
    (await request("POST", `${route()}/payments`, { ...input, amount: "0,20" }, owner))
      .statusCode,
    409,
  )
  assert.equal(
    (await request("POST", `${route()}/payments`, command(id, "0,20", 10), owner))
      .statusCode,
    201,
  )
  assert.equal(
    (await request("POST", `${route()}/payments`, command(id, "0,01", 0), owner))
      .statusCode,
    409,
  )
  assert.equal(
    (await request("POST", `${route()}/payments`, command(id, "9,72", 30), owner))
      .statusCode,
    422,
  )
  assert.equal(
    (await request("POST", `${route()}/payments`, command(id, "9,71", 30), owner))
      .statusCode,
    201,
  )
  const balance = value<OrderBalance>(
    (await request("GET", `${route()}/orders/${id}/balance`, undefined, owner)).body,
  )
  assert.equal(balance.paid, 1001)
  assert.equal(balance.outstanding, 0)
  assert.equal(balance.payments.length, 3)
  for (const amount of ["-1", "1,001", "1e3", "0"])
    assert.equal(
      (await request("POST", `${route()}/payments`, command(null, amount), owner))
        .statusCode,
      422,
    )
})
test("two concurrent cashiers cannot overpay an order", async () => {
  const id = await order()
  const results = await Promise.all([
    request("POST", `${route()}/payments`, command(id), owner),
    request("POST", `${route()}/payments`, command(id), owner),
  ])
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409])
  const balance = value<OrderBalance>(
    (await request("GET", `${route()}/orders/${id}/balance`, undefined, owner)).body,
  )
  assert.equal(balance.paid, 1001)
  assert.equal(balance.payments.length, 1)
})
test("reversal preserves attribution, is repeat-safe and reopens the exact order balance", async () => {
  const id = await order()
  const payment = value<PaymentView>(
    (await request("POST", `${route()}/payments`, command(id), owner)).body,
  )
  const endpoint = `${route()}/payments/${payment.id}/reverse`
  const reversed = value<PaymentView>(
    (await request("POST", endpoint, { reason: "Registro duplicado conferido" }, owner))
      .body,
  )
  const repeated = value<PaymentView>(
    (await request("POST", endpoint, { reason: "Outra tentativa" }, owner)).body,
  )
  assert.equal(reversed.recordedBy, owner.userId)
  assert.equal(reversed.reversedBy, owner.userId)
  assert.equal(repeated.reversedAt, reversed.reversedAt)
  assert.equal(repeated.reversalReason, reversed.reversalReason)
  const balance = value<OrderBalance>(
    (await request("GET", `${route()}/orders/${id}/balance`, undefined, owner)).body,
  )
  assert.equal(balance.paid, 0)
  assert.equal(balance.outstanding, 1001)
})
test("cancellation preserves money history and blocks new receipts", async () => {
  const id = await order()
  await request("POST", `${route()}/payments`, command(id, "1,00"), owner)
  assert.equal(
    (
      await request(
        "PUT",
        `${route()}/orders/${id}/status`,
        { expectedRevision: 0, status: "CANCELLED" },
        owner,
      )
    ).statusCode,
    200,
  )
  assert.equal(
    (await request("POST", `${route()}/payments`, command(id, "9,01", 100), owner))
      .statusCode,
    422,
  )
  const balance = value<OrderBalance>(
    (await request("GET", `${route()}/orders/${id}/balance`, undefined, owner)).body,
  )
  assert.equal(balance.cancelled, true)
  assert.equal(balance.paid, 100)
  assert.equal(balance.outstanding, 0)
})
test("role permissions are enforced server-side for finance and reports", async () => {
  const payment = value<PaymentView>(
    (await request("POST", `${route()}/payments`, command(null), owner)).body,
  )
  for (const role of [
    "CASHIER",
    "KITCHEN",
    "COURIER",
    "VIEWER",
    "STAFF",
    "MANAGER",
  ] as Role[]) {
    await server.runtime.db.client.membership.upsert({
      where: {
        tenantId_userId: { tenantId: owner.store.tenantId, userId: other.userId },
      },
      create: { tenantId: owner.store.tenantId, userId: other.userId, role },
      update: { role },
    })
    const allowed = role === "CASHIER" || role === "MANAGER"
    assert.equal(
      (await request("GET", `${route()}/payments?${range()}`, undefined, other))
        .statusCode,
      allowed ? 200 : 403,
      role,
    )
    assert.equal(
      (await request("POST", `${route()}/payments`, command(null, "0,01"), other))
        .statusCode,
      allowed ? 201 : 403,
      role,
    )
    assert.equal(
      (await request("GET", `${route()}/reports/financial?${range()}`, undefined, other))
        .statusCode,
      role === "MANAGER" ? 200 : 403,
      role,
    )
    assert.equal(
      (
        await request(
          "POST",
          `${route()}/payments/${payment.id}/reverse`,
          { reason: "Conferência de teste" },
          other,
        )
      ).statusCode,
      role === "MANAGER" ? 201 : 403,
      role,
    )
  }
})
test("reports include all period activity, reject oversized ranges and do not expose customer data", async () => {
  const report = value<FinancialReport>(
    (await request("GET", `${route()}/reports/financial?${range()}`, undefined, owner))
      .body,
  )
  assert.equal(report.orders.length, 4)
  assert.equal(report.summary.cancelled, 1)
  assert.equal(report.summary.sales, 3003)
  assert.ok(report.payments.some((p) => !p.orderId))
  assert.doesNotMatch(JSON.stringify(report), /Cliente de teste|11999999999|Rua de teste/)
  const page = value<PaymentPage>(
    (await request("GET", `${route()}/payments?${range()}`, undefined, owner)).body,
  )
  assert.equal(page.items.length, report.payments.length)
  assert.equal(
    (
      await request(
        "GET",
        `${route()}/reports/financial?from=2026-01-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
        undefined,
        owner,
      )
    ).statusCode,
    422,
  )
})

test("real reports use movement dates independently from order dates and preserve later-paid current balances", async () => {
  const db = server.runtime.db.client
  const oldOrder = await order(),
    newOrder = await order()
  const oldPayment = value<PaymentView>(
    (await request("POST", `${route()}/payments`, command(oldOrder, "1,00"), owner)).body,
  )
  const latePayment = value<PaymentView>(
    (await request("POST", `${route()}/payments`, command(newOrder, "10,01"), owner))
      .body,
  )
  const standalone = value<PaymentView>(
    (await request("POST", `${route()}/payments`, command(null, "0,10"), owner)).body,
  )
  for (const payment of [oldPayment, standalone]) {
    assert.equal(
      (
        await request(
          "POST",
          `${route()}/payments/${payment.id}/reverse`,
          { reason: "Conferência de período" },
          owner,
        )
      ).statusCode,
      201,
    )
  }
  // Backdate only this test's own records to exercise day boundaries without waiting days.
  await db.order.update({
    where: { id: oldOrder },
    data: { createdAt: new Date("2026-09-30T12:00:00Z") },
  })
  await db.order.update({
    where: { id: newOrder },
    data: { createdAt: new Date("2026-10-01T12:00:00Z") },
  })
  await db.payment.update({
    where: { id: oldPayment.id },
    data: {
      createdAt: new Date("2026-10-01T03:00:00Z"),
      reversedAt: new Date("2026-10-02T03:00:00Z"),
    },
  })
  await db.payment.update({
    where: { id: latePayment.id },
    data: { createdAt: new Date("2026-10-02T03:00:00Z") },
  })
  await db.payment.update({
    where: { id: standalone.id },
    data: {
      createdAt: new Date("2026-10-01T12:00:00Z"),
      reversedAt: new Date("2026-10-01T13:00:00Z"),
    },
  })
  const first = value<FinancialReport>(
    (
      await request(
        "GET",
        `${route()}/reports/financial?from=2026-10-01T03:00:00Z&to=2026-10-02T03:00:00Z`,
        undefined,
        owner,
      )
    ).body,
  )
  assert.equal(first.orders.length, 1)
  assert.equal(first.summary.sales, 1001)
  assert.equal(first.orders[0]!.paid, 1001)
  assert.equal(first.summary.outstanding, 0)
  assert.equal(first.summary.received, 110)
  assert.equal(first.summary.reversed, 10)
  assert.equal(first.summary.netReceived, 100)
  const second = value<FinancialReport>(
    (
      await request(
        "GET",
        `${route()}/reports/financial?from=2026-10-02T03:00:00Z&to=2026-10-03T03:00:00Z`,
        undefined,
        owner,
      )
    ).body,
  )
  assert.equal(second.orders.length, 0)
  assert.equal(second.summary.sales, 0)
  assert.equal(second.summary.received, 1001)
  assert.equal(second.summary.reversed, 100)
  assert.equal(second.summary.netReceived, 901)
})

test("large financial snapshots use real workers with exact cents and bounded concurrent requests", async () => {
  const at = new Date("2026-02-10T12:00:00.000Z")
  await server.runtime.db.client.payment.createMany({
    data: Array.from({ length: 2000 }, (_, index) => ({
      id: randomUUID(),
      tenantId: owner.store.tenantId,
      restaurantId: owner.store.id,
      amount: 101,
      method: "PIX",
      description: "Movimento sintético para teste de carga",
      recordedBy: owner.userId,
      requestHash: index.toString(16).padStart(64, "0"),
      payloadHash: "0".repeat(64),
      createdAt: at,
      ...(index % 2 === 0
        ? {
            reversedAt: at,
            reversedBy: owner.userId,
            reversalReason: "Conferência sintética",
          }
        : {}),
    })),
  })
  const endpoint = `${route()}/reports/financial?from=2026-02-10T00:00:00Z&to=2026-02-11T00:00:00Z`
  const jobs = Array.from({ length: 5 }, () => request("GET", endpoint, undefined, owner))
  const healthy = await request("GET", "/health/ready")
  assert.equal(healthy.statusCode, 200)
  const responses = await Promise.all(jobs)
  assert.ok(responses.some((response) => response.statusCode === 200))
  for (const response of responses) {
    assert.ok([200, 503].includes(response.statusCode))
    if (response.statusCode === 503) {
      assert.equal(JSON.parse(response.body).error.code, "CAPABILITY_UNAVAILABLE")
      continue
    }
    const report = value<FinancialReport>(response.body)
    assert.equal(report.payments.length, 2000)
    assert.equal(report.summary.received, 202000)
    assert.equal(report.summary.reversed, 101000)
    assert.equal(report.summary.netReceived, 101000)
  }
  assert.equal(server.runtime.cpuTasks.active, 0)
  await server.runtime.db.client.membership.update({
    where: { tenantId_userId: { tenantId: owner.store.tenantId, userId: other.userId } },
    data: { role: "CASHIER" },
  })
  assert.equal((await request("GET", endpoint, undefined, other)).statusCode, 403)
})
