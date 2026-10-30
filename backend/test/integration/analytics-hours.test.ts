import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomInt } from "node:crypto"
import {
  currentLegalAcceptance,
  type AnalyticsReport,
  type RestaurantAccess,
  type SessionView,
} from "@cardapio/contracts"
import {
  defaultStoreHours,
  localClock,
  addCalendarDays,
  zonedInstant,
} from "@cardapio/domain/store-hours"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { createApplication } from "../../src/app/bootstrap.js"
import { loadConfig } from "../../src/app/config.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Analytics tests require an isolated _test database.")
const suffix = randomUUID().slice(0, 8),
  origin = "http://localhost:8443",
  users: string[] = []
let server: Awaited<ReturnType<typeof createApplication>>
type Login = { cookie: string; csrf: string; userId: string; store?: RestaurantAccess }
let owner: Login, other: Login, courier: Login, viewer: Login, menu: MenuDocument
const timezone = "America/Sao_Paulo",
  date = addCalendarDays(localClock(Date.now(), timezone).date, -1),
  prior = addCalendarDays(date, -1)
const defaultSchedule = () => {
  const { override: _override, ...schedule } = defaultStoreHours()
  return schedule
}
function value<T>(response: { body: string }): T {
  const result = JSON.parse(response.body)
  assert.equal(result.ok, true, result.error?.message)
  return result.value
}
function request(
  method: "GET" | "POST" | "PUT",
  path: string,
  payload?: unknown,
  login: Login | undefined = owner,
  headers: Record<string, string> = {},
) {
  return server.app.inject({
    method,
    url: "/api/v1" + path,
    remoteAddress: `10.86.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    headers: {
      origin,
      ...(login ? { cookie: login.cookie, "x-csrf-token": login.csrf } : {}),
      ...headers,
    },
    ...(method === "GET" ? {} : { payload: payload ?? {} }),
  })
}
async function register(name: string, store = true): Promise<Login> {
  const result = await request(
    "POST",
    store ? "/auth/register" : "/auth/register-account",
    {
      name,
      email: `analytics-${name.toLowerCase().replaceAll(" ", "-")}-${suffix}@example.test`,
      password: "M7!qR2@x",
      legalAcceptance: currentLegalAcceptance,
      ...(store
        ? {
            restaurantName: `Loja ${name}`,
            slug: `analytics-${name.toLowerCase()}-${suffix}`,
          }
        : {}),
    },
    undefined,
  )
  const session = value<SessionView>(result),
    login: Login = {
      cookie: String(result.headers["set-cookie"]).split(";")[0]!,
      csrf: session.csrfToken,
      userId: session.user.id,
    }
  users.push(login.userId)
  await server.runtime.db.client.user.update({
    where: { id: login.userId },
    data: { emailVerifiedAt: new Date() },
  })
  if (store)
    login.store = value<RestaurantAccess[]>(
      await request("GET", "/me/restaurants", undefined, login),
    )[0]!
  return login
}
const route = () => `/restaurants/${owner.store!.id}`
const query = (period = "DAY") => `?period=${period}&date=${date}`
async function seed(
  login: Login,
  input: {
    day: string
    hour: number
    phone: string
    status?: "COMPLETED" | "CANCELLED" | "NEW"
    product: number
    quantity?: number
    delivery?: boolean
    coupon?: boolean
    combo?: boolean
  },
) {
  const at = new Date(
      zonedInstant(input.day, `${String(input.hour).padStart(2, "0")}:00`, timezone),
    ),
    id = randomUUID(),
    product = menu.products[input.product]!
  const quantity = input.quantity ?? 1,
    items = [
      {
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.price,
        note: "Observação privada",
      },
    ]
  if (input.combo)
    items.push({
      productId: menu.products[2]!.id,
      name: "Combo histórico",
      quantity: 1,
      unitPrice: 4000,
      note: "",
      ...{ kind: "COMBO" },
    })
  const subtotal = items.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0),
    fee = input.delivery ? 500 : 0,
    discount = input.coupon ? 2 : 0
  const ready = input.hour === 10 ? 10 : input.hour === 11 ? 20 : 30,
    drive = input.hour === 10 ? 20 : 30
  const timestamp = (minutes: number) =>
    new Date(at.getTime() + minutes * 60000).toISOString()
  const history = [
    { status: "NEW", at: timestamp(0) },
    { status: "PREPARING", at: timestamp(1) },
    { status: "READY", at: timestamp(ready) },
    ...(input.delivery ? [{ status: "OUT_FOR_DELIVERY", at: timestamp(ready + 2) }] : []),
    { status: "COMPLETED", at: timestamp(ready + (input.delivery ? 2 + drive : 5)) },
  ]
  await server.runtime.db.client.order.create({
    data: {
      id,
      tenantId: login.store!.tenantId,
      restaurantId: login.store!.id,
      status: input.status ?? "COMPLETED",
      customer: {
        name: input.phone.endsWith("0001") ? "Cliente Alfa" : "Cliente Beta",
        phone: input.phone,
        address: "Rua secreta, 99",
        notes: "Mensagem privada",
        payment: "Pix",
        cashChange: "",
      },
      items,
      subtotal,
      deliveryFee: fee,
      discount,
      total: subtotal + fee - discount,
      fulfillment: { mode: input.delivery ? "DELIVERY" : "PICKUP" },
      courierId: input.delivery ? courier.userId : null,
      history,
      checkoutRevision: 0,
      whatsappUrl: "",
      idempotencyHash: server.runtime.secrets.hash(id),
      payloadHash: "a".repeat(64),
      createdAt: at,
      ...(input.coupon
        ? { promotionId: randomUUID(), promotionName: "Oferta teste" }
        : {}),
    },
  })
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
      LOG_LEVEL: "silent",
    }),
  )
  owner = await register("Gestor")
  other = await register("Outro")
  courier = await register("Entregador", false)
  viewer = await register("Consulta", false)
  for (const [login, role] of [
    [courier, "COURIER"],
    [viewer, "VIEWER"],
  ] as const) {
    const member = await server.runtime.db.client.user.findUniqueOrThrow({
      where: { id: login.userId },
      select: { email: true },
    })
    assert.equal(
      (
        await request("POST", `/tenants/${owner.store!.tenantId}/members`, {
          email: member.email,
          role,
        })
      ).statusCode,
      201,
    )
  }
  for (const [name, price] of [
    ["Produto Alfa", "10,01"],
    ["Produto Beta", "25,00"],
    ["Produto Gama", "35,00"],
  ]) {
    const current = value<MenuDocument>(await request("GET", route() + "/menu"))
    menu = value<MenuDocument>(
      await request("POST", route() + "/products", {
        expectedRevision: current.revision,
        name,
        description: "",
        price,
        categoryId: current.categories[0]?.id ?? "",
        ...(current.categories.length ? {} : { newCategoryName: "Produtos" }),
        imageUrl: "",
        available: true,
        popular: false,
      }),
    )
  }
  menu = {
    ...menu,
    products: [...menu.products].sort((a, b) => a.name.localeCompare(b.name)),
  }
  await seed(owner, { day: prior, hour: 10, phone: "5511999990001", product: 0 })
  await seed(owner, {
    day: date,
    hour: 10,
    phone: "5511999990001",
    product: 0,
    quantity: 2,
    delivery: true,
    coupon: true,
  })
  await seed(owner, {
    day: date,
    hour: 11,
    phone: "5511999990001",
    product: 0,
    combo: true,
  })
  await seed(owner, {
    day: date,
    hour: 12,
    phone: "5511999990002",
    product: 1,
    delivery: true,
  })
  await seed(owner, {
    day: date,
    hour: 13,
    phone: "5511999990003",
    product: 1,
    status: "CANCELLED",
    quantity: 99,
  })
  await seed(owner, {
    day: date,
    hour: 14,
    phone: "5511999990004",
    product: 2,
    status: "NEW",
    quantity: 99,
  })
  await seed(other, {
    day: date,
    hour: 12,
    phone: "5511999990005",
    product: 1,
    quantity: 99,
  })
})
after(async () => {
  if (!server) return
  await server.runtime.db.transaction(async (tx) => {
    const memberships = await tx.membership.findMany({
        where: { userId: { in: users }, role: "OWNER" },
        select: { tenantId: true },
      }),
      tenantId = { in: memberships.map((m) => m.tenantId) }
    await tx.payment.deleteMany({ where: { tenantId } })
    await tx.order.deleteMany({ where: { tenantId } })
    await tx.storeCommerce.deleteMany({ where: { tenantId } })
    await tx.product.deleteMany({ where: { tenantId } })
    await tx.category.deleteMany({ where: { tenantId } })
    await tx.restaurant.deleteMany({ where: { tenantId } })
    await tx.membership.deleteMany({
      where: { OR: [{ tenantId }, { userId: { in: users } }] },
    })
    await tx.tenant.deleteMany({ where: { id: tenantId } })
    await tx.user.deleteMany({ where: { id: { in: users } } })
  })
  await server.close()
})
test("analytics aggregates exact completed sales, customers, delivery times and excludes cancelled/pending and other tenants", async () => {
  const response = await request("GET", route() + "/analytics" + query())
  assert.equal(response.statusCode, 200, response.body)
  const result = value<AnalyticsReport>(response)
  assert.equal(result.current.completed, 3)
  assert.equal(result.current.orders, 5)
  assert.equal(result.current.cancelled, 1)
  assert.equal(result.current.inProgress, 1)
  assert.equal(result.current.revenue, 10501)
  assert.equal(result.current.itemsRevenue, 9503)
  assert.equal(result.current.deliveryFees, 1000)
  assert.equal(result.current.discounts, 2)
  assert.equal(result.current.customers, 2)
  assert.equal(result.current.newCustomers, 1)
  assert.equal(result.current.returningCustomers, 1)
  assert.equal(result.current.repeatCustomers, 1)
  assert.equal(result.current.deliveries, 2)
  assert.equal(result.current.pickups, 1)
  assert.equal(result.current.avgPreparationMinutes, 20)
  assert.equal(result.current.avgDeliveryMinutes, 25)
  assert.equal(result.previous.revenue, 1001)
  assert.equal(result.products[0]!.units, 3)
  assert.equal(result.products.find((p) => p.kind === "COMBO")!.revenue, 4000)
  assert.equal(result.couriers[0]!.deliveries, 2)
  assert.equal(result.couriers[0]!.avgMinutes, 25)
  assert.equal(result.customers[0]!.orders, 2)
  assert.equal(
    result.series.reduce((sum, b) => sum + b.revenue, 0),
    10501,
  )
  assert.equal(result.paymentMethods[0]!.orders, 3)
  assert.equal(result.promotions[0]!.discounts, 2)
  for (const privateValue of [
    "5511999990001",
    "Rua secreta",
    "Mensagem privada",
    "Observação privada",
  ])
    assert.equal(response.body.includes(privateValue), false)
})
test("analytics respects permissions, tenant scope, strict inputs and all calendar comparisons", async () => {
  assert.equal(
    (
      await request("GET", route() + "/analytics" + query(), undefined, {
        ...owner,
        cookie: "",
        csrf: "",
      })
    ).statusCode,
    401,
  )
  assert.equal(
    (await request("GET", route() + "/analytics" + query(), undefined, viewer))
      .statusCode,
    403,
  )
  assert.equal(
    (await request("GET", route() + "/analytics" + query(), undefined, other)).statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "GET",
        route() + "/analytics" + query() + "&tenantId=" + other.store!.tenantId,
      )
    ).statusCode,
    422,
  )
  for (const period of ["DAY", "WEEK", "MONTH", "YEAR"]) {
    const response = await request("GET", route() + "/analytics" + query(period))
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(value<AnalyticsReport>(response).range.period, period)
  }
})
test("public best sellers expose only ranked product IDs, counting completed sales and excluding combos", async () => {
  const response = await request(
    "GET",
    `/public/restaurants/${owner.store!.slug}/best-sellers`,
    undefined,
    { ...owner, cookie: "", csrf: "" },
  )
  assert.equal(response.statusCode, 200, response.body)
  const result = value<{ productIds: string[]; days: number }>(response)
  assert.deepEqual(result.productIds, [menu.products[0]!.id, menu.products[1]!.id])
  assert.equal(result.days, 30)
  assert.deepEqual(Object.keys(result).sort(), ["days", "productIds"])
})
test("store hours are revisioned, scoped and protected by CSRF; invalid schedules never persist", async () => {
  const current = value<MenuDocument>(await request("GET", route() + "/menu")),
    schedule = { ...defaultSchedule(), enabled: true }
  assert.equal(
    (
      await request(
        "PUT",
        route() + "/hours",
        { expectedRevision: current.revision, schedule },
        other,
      )
    ).statusCode,
    404,
  )
  assert.equal(
    (
      await request(
        "PUT",
        route() + "/hours",
        { expectedRevision: current.revision, schedule },
        owner,
        { "x-csrf-token": "invalid" },
      )
    ).statusCode,
    403,
  )
  assert.equal(
    (
      await request("PUT", route() + "/hours", {
        expectedRevision: current.revision,
        schedule: { ...schedule, weekly: [[]] },
      })
    ).statusCode,
    422,
  )
  const response = await request("PUT", route() + "/hours", {
    expectedRevision: current.revision,
    schedule,
  })
  assert.equal(response.statusCode, 200, response.body)
  assert.equal(value<MenuDocument>(response).restaurant.isOpen, false)
  assert.equal(
    (
      await request("PUT", route() + "/hours", {
        expectedRevision: current.revision,
        schedule,
      })
    ).statusCode,
    409,
  )
})
function checkout(current: MenuDocument) {
  return {
    expectedRevision: current.revision,
    cart: {
      restaurantId: owner.store!.id,
      lines: [
        { productId: menu.products[0]!.id, quantity: 1, unitPrice: 1001, note: "" },
      ],
    },
    details: {
      name: "Cliente Horários",
      phone: "11999990001",
      address: "Rua Teste, 10",
      deliveryAddress: {
        street: "Rua Teste",
        number: "10",
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
  }
}
test("the server accepts orders during scheduled opening and refuses quotes and orders on a holiday without relying on a browser or cron", async () => {
  let current = value<MenuDocument>(await request("GET", route() + "/menu"))
  const schedule = {
    ...defaultSchedule(),
    enabled: true,
    weekly: Array.from({ length: 7 }, () => [{ opensAt: "00:00", closesAt: "24:00" }]),
  }
  current = value<MenuDocument>(
    await request("PUT", route() + "/hours", {
      expectedRevision: current.revision,
      schedule,
    }),
  )
  assert.equal(current.restaurant.isOpen, true)
  assert.equal(
    (
      await server.runtime.db.client.restaurant.findUniqueOrThrow({
        where: { id: owner.store!.id },
      })
    ).isOpen,
    false,
  )
  const data = checkout(current)
  assert.equal(
    (
      await request("POST", `/public/restaurants/${owner.store!.slug}/checkout/quote`, {
        expectedRevision: data.expectedRevision,
        cart: data.cart,
      })
    ).statusCode,
    201,
  )
  const closed = {
    ...schedule,
    exceptions: [
      {
        date: localClock(Date.now(), schedule.timeZone).date,
        label: "Feriado",
        yearly: false,
        intervals: [],
      },
    ],
  }
  current = value<MenuDocument>(
    await request("PUT", route() + "/hours", {
      expectedRevision: current.revision,
      schedule: closed,
    }),
  )
  assert.equal(current.restaurant.isOpen, false)
  const body = checkout(current),
    before = await server.runtime.db.client.order.count({
      where: { restaurantId: owner.store!.id },
    })
  const quote = await request(
    "POST",
    `/public/restaurants/${owner.store!.slug}/checkout/quote`,
    { expectedRevision: body.expectedRevision, cart: body.cart },
  )
  assert.equal(quote.statusCode, 422)
  assert.match(quote.body, /fechada/)
  const order = await request(
    "POST",
    `/public/restaurants/${owner.store!.slug}/orders`,
    body,
    owner,
    { "idempotency-key": randomUUID() },
  )
  assert.equal(order.statusCode, 422)
  assert.match(order.body, /fechada/)
  assert.equal(
    await server.runtime.db.client.order.count({
      where: { restaurantId: owner.store!.id },
    }),
    before,
  )
})
test("manual switches create an expiring override and saving the schedule restores automation", async () => {
  const current = value<MenuDocument>(await request("GET", route() + "/menu"))
  const opened = value<MenuDocument>(
    await request("PUT", route() + "/open", {
      expectedRevision: current.revision,
      isOpen: true,
    }),
  )
  assert.equal(opened.restaurant.isOpen, true)
  assert.equal(opened.restaurant.hours?.override?.isOpen, true)
  assert.ok(
    Date.parse(opened.restaurant.hours!.override!.until) <= Date.now() + 12 * 3600000,
  )
  const { override: _override, ...schedule } = opened.restaurant.hours!
  const resumed = value<MenuDocument>(
    await request("PUT", route() + "/hours", {
      expectedRevision: opened.revision,
      schedule,
    }),
  )
  assert.equal(resumed.restaurant.hours!.override, null)
  assert.equal(resumed.restaurant.isOpen, false)
})

test("analytics includes more than 5,000 orders without silently truncating a calendar period", async () => {
  const at = new Date(zonedInstant(date, "10:00", timezone)),
    scope = other.store!
  await server.runtime.db.client.$executeRaw`
    INSERT INTO "Order" (id, "tenantId", "restaurantId", status, customer, items, subtotal, "deliveryFee", total,
      "checkoutRevision", "whatsappUrl", "idempotencyHash", "payloadHash", "createdAt", "updatedAt")
    SELECT gen_random_uuid(), ${scope.tenantId}::uuid, ${scope.id}::uuid, 'COMPLETED',
      jsonb_build_object('name','Cliente Volume','phone','5511999990007','address','','notes','','payment','Pix','cashChange',''),
      jsonb_build_array(jsonb_build_object('productId',${menu.products[0]!.id}::text,'name','Produto volume','quantity',1,'unitPrice',1001,'note','')),
      1001, 0, 1001, 0, '', md5(${suffix} || seq::text) || md5(seq::text || ${suffix}), repeat('a',64), ${at}, ${at}
    FROM generate_series(1,5001) seq`
  const response = await request(
    "GET",
    `/restaurants/${scope.id}/analytics${query("YEAR")}`,
    undefined,
    other,
  )
  assert.equal(response.statusCode, 200, response.body)
  const result = value<AnalyticsReport>(response)
  assert.equal(result.current.completed, 5002)
  assert.equal(result.current.revenue, 5001 * 1001 + 99 * 2500)
  assert.equal(
    result.series.reduce((sum, bucket) => sum + bucket.orders, 0),
    5002,
  )
})
