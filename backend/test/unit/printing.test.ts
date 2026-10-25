import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import {
  defaultPrintingSettings,
  canPrintReceipt,
  receiptKinds,
} from "@cardapio/domain/printing"
import { can, type Role } from "@cardapio/domain/permissions"
import { Failure } from "@cardapio/domain/failure"
import {
  printingSettingsSchema,
  updatePrintingSettingsSchema,
  receiptTemplateSchema,
  type PaymentView,
  type ReceiptKind,
} from "@cardapio/contracts"
import { Printing } from "../../src/modules/printing/application/printing.js"
import { buildReceipt } from "../../src/modules/printing/application/snapshot.js"
import type {
  PrintingRepository,
  PrintingSource,
} from "../../src/modules/printing/application/ports.js"
import type { AccessPolicy } from "../../src/modules/identity/application/ports.js"
import { Operation } from "../../src/shared/application/operation.js"

const now = "2026-10-24T13:00:00.000Z"
const restaurantId = randomUUID(),
  orderId = randomUUID(),
  userId = randomUUID()
const actor = { userId, sessionId: randomUUID() }
const scope = { tenantId: randomUUID(), restaurantId }
const payment = (patch: Partial<PaymentView> = {}): PaymentView => ({
  id: randomUUID(),
  orderId,
  amount: 30,
  method: "PIX",
  description: "",
  createdAt: "2026-10-24T12:00:00.000Z",
  recordedBy: userId,
  reversedAt: null,
  reversedBy: null,
  reversalReason: null,
  ...patch,
})
function source(): PrintingSource {
  return {
    settings: defaultPrintingSettings(),
    restaurant: {
      id: restaurantId,
      name: "Loja",
      address: "Rua da loja, 1",
      phone: "11988887777",
    },
    order: {
      id: orderId,
      restaurantId,
      revision: 3,
      status: "READY",
      createdAt: "2026-10-24T10:00:00.000Z",
      customer: {
        name: "Cliente privado",
        phone: "11999999999",
        address: "Rua privada, 12",
        notes: "Portão azul",
        payment: "Dinheiro",
        cashChange: "20,00",
      },
      items: [
        {
          productId: randomUUID(),
          name: "Lanche",
          quantity: 2,
          unitPrice: 501,
          note: "Sem cebola",
          components: ["Extra queijo"],
        },
      ],
      subtotal: 1002,
      deliveryFee: 100,
      discount: 101,
      total: 1001,
      fulfillment: { mode: "DELIVERY" },
      courierId: userId,
    },
    payment: null,
    payments: [payment({ amount: 10 }), payment({ amount: 20 })],
  }
}
test("printing defaults are valid and shared schemas reject unsafe templates and dangling defaults", () => {
  const settings = defaultPrintingSettings()
  assert.equal(printingSettingsSchema.safeParse(settings).success, true)
  assert.equal(
    printingSettingsSchema.safeParse({
      ...settings,
      defaults: { ...settings.defaults, ORDER: "missing" },
    }).success,
    false,
  )
  assert.equal(
    printingSettingsSchema.safeParse({
      ...settings,
      profiles: [settings.profiles[0], settings.profiles[0]],
    }).success,
    false,
  )
  assert.equal(
    printingSettingsSchema.safeParse({
      ...settings,
      profiles: [{ ...settings.profiles[0], copies: 0 }],
    }).success,
    false,
  )
  assert.equal(
    printingSettingsSchema.safeParse({
      ...settings,
      profiles: [{ ...settings.profiles[0], printableWidthMm: 100 }],
    }).success,
    false,
  )
  const removed = structuredClone(settings)
  removed.templates.ORDER.blocks = [{ type: "divider", data: {} }]
  assert.equal(printingSettingsSchema.safeParse(removed).success, false)
  for (const block of [
    { type: "html", data: { html: "<img src=x onerror=alert(1)>" } },
    { type: "text", data: { text: "<script>alert(1)</script>", align: "left" } },
    { type: "text", data: { text: "escape\u001b@", align: "left" } },
    { type: "section", data: { section: "customer.password" } },
    { type: "logo", data: { size: "medium", src: "https://foreign.test/logo.png" } },
  ])
    assert.equal(receiptTemplateSchema.safeParse({ blocks: [block] }).success, false)
  assert.equal(
    printingSettingsSchema.safeParse({
      ...settings,
      logo: "https://foreign.test/logo.png",
    }).success,
    false,
  )
  const { revision, ...rest } = settings
  assert.equal(
    updatePrintingSettingsSchema.safeParse({
      ...rest,
      expectedRevision: revision,
      tenantId: randomUUID(),
    }).success,
    false,
  )
})
test("purpose policy is explicit and configuration belongs only to owner and manager", () => {
  const allowed: Record<Role, ReceiptKind[]> = {
    OWNER: [...receiptKinds],
    MANAGER: [...receiptKinds],
    CASHIER: [...receiptKinds],
    STAFF: ["ORDER", "KITCHEN", "DELIVERY"],
    KITCHEN: ["KITCHEN"],
    COURIER: ["DELIVERY"],
    VIEWER: [],
  }
  for (const [role, kinds] of Object.entries(allowed)) {
    for (const kind of receiptKinds)
      assert.equal(canPrintReceipt(role as Role, kind), kinds.includes(kind))
    assert.equal(
      can(role as Role, "printing:configure"),
      role === "OWNER" || role === "MANAGER",
    )
  }
})
test("receipt totals come from persisted order cents and current non-reversed ledger", () => {
  const input = source()
  input.payments.push(
    payment({
      amount: 100,
      reversedAt: now,
      reversedBy: userId,
      reversalReason: "Registro duplicado",
    }),
  )
  const doc = buildReceipt(input, "ORDER", now)
  assert.deepEqual(doc.snapshot.totals, {
    subtotal: 1002,
    deliveryFee: 100,
    discount: 101,
    total: 1001,
    paid: 30,
    outstanding: 971,
  })
  assert.equal(doc.snapshot.items[0]!.total, 1002)
  assert.equal(doc.snapshot.source.orderRevision, 3)
  assert.equal(doc.snapshot.source.createdAt, input.order!.createdAt)
  assert.equal(doc.snapshot.generatedAt, now)
  assert.equal(doc.snapshot.payment, null)
  input.order!.status = "CANCELLED"
  assert.equal(buildReceipt(input, "ORDER", now).snapshot.totals!.outstanding, 0)
  input.order!.total++
  assert.throws(() => buildReceipt(input, "ORDER", now))
})
test("kitchen projection removes customer and all financial fields before templates see the document", () => {
  const doc = buildReceipt(source(), "KITCHEN", now).snapshot
  assert.equal(doc.customer, null)
  assert.equal(doc.totals, null)
  assert.equal(doc.payment, null)
  assert.equal(doc.notes, "")
  assert.equal(doc.items[0]!.unitPrice, null)
  assert.equal(doc.items[0]!.total, null)
  assert.equal(doc.items[0]!.note, "Sem cebola")
  assert.doesNotMatch(
    JSON.stringify(doc),
    /Cliente privado|Rua privada|11999999999|Portão azul/,
  )
})
test("payment receipt preserves original movement and marks reversal without making a bank refund claim", () => {
  const input = source()
  input.payment = payment({
    reversedAt: now,
    reversedBy: userId,
    reversalReason: "Registro duplicado conferido",
  })
  const doc = buildReceipt(input, "PAYMENT", now).snapshot
  assert.equal(doc.source.paymentStatus, "REVERSED")
  assert.equal(doc.source.paymentId, input.payment.id)
  assert.equal(doc.source.createdAt, input.payment.createdAt)
  assert.equal(doc.payment!.amount, 30)
  assert.equal(doc.payment!.reversedAt, now)
  assert.equal(doc.payment!.reversalReason, "Registro duplicado conferido")
  assert.equal(doc.customer, null)
  assert.deepEqual(doc.items, [])
  assert.doesNotMatch(JSON.stringify(doc), /recordedBy|reversedBy|refunded/)
  input.order = null
  input.payment.orderId = null
  input.payments = []
  assert.equal(buildReceipt(input, "PAYMENT", now).snapshot.totals, null)
})
test("cases of use authorize direct calls before reading repositories and validate IDs and purpose", async () => {
  let role: Role = "CASHIER",
    reads = 0
  const access: AccessPolicy = {
    async session() {},
    async tenant() {},
    async grant(_actor, id, permission) {
      if (id !== restaurantId) throw new Failure("NOT_FOUND", "Loja indisponível")
      if (!can(role, permission)) throw new Failure("ACCESS_DENIED", "Sem acesso")
      return { scope, role }
    },
    async restaurant(actor, id, permission) {
      return (await this.grant(actor, id, permission)).scope
    },
  }
  const repository: PrintingRepository = {
    async settings(actual) {
      assert.deepEqual(actual, scope)
      return defaultPrintingSettings()
    },
    async update() {
      throw new Error("must not mutate")
    },
    async source(actual, _kind, _id, operator) {
      reads++
      assert.deepEqual(actual, scope)
      assert.equal(operator.userId, userId)
      return source()
    },
  }
  const clock = { now: () => new Date(now) }
  const app = new Printing(
    repository,
    access,
    new Operation({ record() {} }, { next: randomUUID }, clock),
    clock,
  )
  assert.equal((await app.order(actor, restaurantId, orderId, "ORDER")).ok, true)
  assert.equal(reads, 1)
  assert.equal((await app.update(actor, restaurantId, {})).ok, false)
  role = "KITCHEN"
  assert.equal((await app.order(actor, restaurantId, orderId, "ORDER")).ok, false)
  assert.equal((await app.payment(actor, restaurantId, randomUUID())).ok, false)
  assert.equal((await app.order(actor, restaurantId, orderId, "KITCHEN")).ok, true)
  role = "COURIER"
  assert.equal((await app.order(actor, restaurantId, orderId, "ORDER")).ok, false)
  role = "VIEWER"
  assert.equal((await app.settings(actor, restaurantId)).ok, false)
  role = "OWNER"
  assert.equal((await app.order(actor, restaurantId, orderId, "PAYMENT")).ok, false)
  assert.equal((await app.order(actor, restaurantId, "bad-id", "ORDER")).ok, false)
  assert.equal((await app.order(actor, randomUUID(), orderId, "ORDER")).ok, false)
  assert.equal(reads, 2)
})
