import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Failure } from "@cardapio/domain/failure"
import type { WhatsappProvider } from "../../src/modules/engagement/application/ports.js"
import { NotificationWorker } from "../../src/modules/engagement/infrastructure/notification-worker.js"
import { SubscriptionCipher } from "../../src/modules/engagement/infrastructure/subscription-cipher.js"
import { Operation } from "../../src/shared/application/operation.js"
import type { DiagnosticLogger } from "../../src/shared/application/ports.js"
import type { Database } from "../../src/shared/infrastructure/database.js"

function fixture() {
  const now = Date.now(),
    scope = { tenantId: randomUUID(), restaurantId: randomUUID() },
    orderId = randomUUID(),
    event = {
      ...scope,
      id: randomUUID(),
      orderId,
      kind: "ORDER",
      status: "NEW",
      createdAt: new Date(now - 1000),
    },
    delivery = {
      id: randomUUID(),
      event,
      eventId: event.id,
      recipient: orderId,
      channel: "WHATSAPP",
      state: "PENDING",
      attempts: 0,
      availableAt: new Date(0),
      claimedAt: null as Date | null,
    },
    diagnostics: Parameters<DiagnosticLogger["record"]>[0][] = [],
    order = {
      id: orderId,
      status: "NEW",
      fulfillment: { mode: "DELIVERY" },
      total: 2022,
      subtotal: 2022,
      deliveryFee: 0,
      discount: 0,
      items: [
        {
          productId: randomUUID(),
          name: "Test item",
          quantity: 1,
          unitPrice: 2022,
          note: "",
        },
      ],
      eta: "30–40 min",
      whatsappConsentAt: new Date(now - 2000),
      whatsappRevokedAt: null as Date | null,
      customer: { phone: "11999999999" },
      restaurant: { name: "Test store", channel: { whatsappEnabled: true } },
    }
  let failReads = false,
    sends = 0,
    message = "",
    latestFinancialId: string = event.id,
    paid = 1011,
    sendResult: "SENT" | "UNKNOWN" | "THROW" = "SENT"
  const client = {
    notificationEvent: {
      findMany: async () => [],
      findFirst: async () => ({ id: latestFinancialId }),
    },
    payment: { aggregate: async () => ({ _sum: { amount: paid } }) },
    notificationDelivery: {
      count: async () => 0,
      findFirst: async () =>
        delivery.state === "PENDING" && delivery.availableAt <= new Date()
          ? { ...delivery }
          : null,
      updateMany: async (query: {
        where: { id?: string; state: string }
        data: {
          state: string
          availableAt?: Date
          claimedAt?: Date
          attempts?: { increment: number }
        }
      }) => {
        // Expired claim recovery does not apply to this fresh fixture.
        if (!query.where.id || query.where.state !== delivery.state) return { count: 0 }
        const { attempts, ...data } = query.data
        Object.assign(delivery, data)
        delivery.attempts += attempts?.increment ?? 0
        return { count: 1 }
      },
    },
    order: {
      findFirst: async () => {
        if (failReads)
          throw new Failure("STORAGE_UNAVAILABLE", "Temporary database failure")
        return order
      },
    },
  }
  const db = {
    run: async (action: (tx: typeof client) => Promise<unknown>) => action(client),
    transaction: async (action: (tx: typeof client) => Promise<unknown>) =>
      action(client),
  } as unknown as Database
  const provider: WhatsappProvider = {
    configured: true,
    state: async () => ({ state: "connected", qr: null }),
    connect: async () => ({ state: "connected", qr: null }),
    disconnect: async () => {},
    send: async (_scope, _number, text) => {
      sends++
      message = text
      if (sendResult === "THROW") throw new Error("private provider payload")
      return sendResult
    },
  }
  return {
    delivery,
    event,
    order,
    diagnostics,
    failReads: (value: boolean) => (failReads = value),
    sendResult: (value: typeof sendResult) => (sendResult = value),
    sends: () => sends,
    message: () => message,
    finance: (id: string, amount: number) => {
      latestFinancialId = id
      paid = amount
    },
    worker: new NotificationWorker(
      db,
      new SubscriptionCipher("test-only"),
      provider,
      { configured: false, send: async () => "SENT" },
      new Operation(
        { record: (entry) => diagnostics.push(entry) },
        { next: randomUUID },
        { now: () => new Date() },
      ),
    ),
  }
}

test("WhatsApp preflight database failures retry without claiming an uncertain delivery", async () => {
  const f = fixture()
  f.failReads(true)
  await f.worker.tick()
  assert.equal(f.sends(), 0)
  assert.equal(f.delivery.state, "PENDING")
  assert.equal(f.delivery.attempts, 1)
  assert.ok(f.delivery.availableAt > new Date())
  f.failReads(false)
  f.delivery.availableAt = new Date(0)
  await f.worker.tick()
  await f.worker.tick()
  assert.equal(f.delivery.state, "SENT")
  assert.equal(f.delivery.attempts, 2)
  assert.equal(f.sends(), 1)
})

test("queued obsolete stages are skipped and consent activation sends automatically", async () => {
  const outdated = fixture()
  outdated.order.status = "COMPLETED"
  await outdated.worker.tick()
  assert.equal(outdated.delivery.state, "SKIPPED")
  assert.equal(outdated.sends(), 0)
  const subscribed = fixture()
  subscribed.event.kind = "SUBSCRIBED"
  subscribed.order.status = "PREPARING"
  await subscribed.worker.tick()
  assert.equal(subscribed.sends(), 1)
  assert.match(subscribed.message(), /Avisos automáticos ativados/)
  assert.match(subscribed.message(), /Em preparo/)
})

test("financial dispatch skips superseded events and sends the current integer balance once", async () => {
  const old = fixture()
  old.event.kind = "PAYMENT"
  old.finance(randomUUID(), 2022)
  await old.worker.tick()
  assert.equal(old.delivery.state, "SKIPPED")
  assert.equal(old.sends(), 0)
  const latest = fixture()
  latest.event.kind = "PAYMENT"
  latest.finance(latest.event.id, 1011)
  await latest.worker.tick()
  await latest.worker.tick()
  assert.equal(latest.sends(), 1)
  assert.match(latest.message(), /Saldo a pagar: \*R\$\s10,11\*/)
})

test("WhatsApp preflight retries stop after five attempts and recheck consent", async () => {
  const f = fixture()
  f.failReads(true)
  for (let attempt = 0; attempt < 5; attempt++) {
    f.delivery.availableAt = new Date(0)
    await f.worker.tick()
  }
  assert.equal(f.delivery.state, "FAILED")
  assert.equal(f.delivery.attempts, 5)
  assert.equal(f.sends(), 0)

  const revoked = fixture()
  revoked.failReads(true)
  await revoked.worker.tick()
  revoked.failReads(false)
  revoked.order.whatsappRevokedAt = new Date()
  revoked.delivery.availableAt = new Date(0)
  await revoked.worker.tick()
  assert.equal(revoked.delivery.state, "SKIPPED")
  assert.equal(revoked.sends(), 0)
})

test("an exception after WhatsApp send starts is never retried or logged with payloads", async () => {
  for (const result of ["THROW", "UNKNOWN"] as const) {
    const f = fixture()
    f.sendResult(result)
    await f.worker.tick()
    f.delivery.availableAt = new Date(0)
    await f.worker.tick()
    assert.equal(f.delivery.state, "UNKNOWN")
    assert.equal(f.sends(), 1)
    assert.doesNotMatch(
      JSON.stringify(f.diagnostics),
      /private provider payload|11999999999|Test store/,
    )
  }
})
