import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { can } from "@cardapio/domain/permissions"
import { assertPaymentBalance, sumCents } from "@cardapio/domain/payments"
import { parseMoney } from "@cardapio/domain/money"
import {
  paymentInputSchema,
  reportRangeSchema,
  type PaymentView,
  type ReportOrder,
} from "@cardapio/contracts"
import { buildReport } from "../../src/modules/payments/application/report.js"
import { createDiagnostics } from "../../src/shared/infrastructure/logging.js"

test("manual payments use exact cents, reject excess and stale balances", () => {
  assert.equal(sumCents([parseMoney("0,10"), parseMoney("0,20")]), 30)
  assert.doesNotThrow(() => assertPaymentBalance(1001, 30, 971, 30))
  assert.throws(() => assertPaymentBalance(1001, 30, 972, 30))
  assert.throws(() => assertPaymentBalance(1001, 30, 971, 0))
  for (const amount of [0, -1, 0.1, NaN, Infinity, 2147483648])
    assert.throws(() => assertPaymentBalance(1001, 0, amount, 0))
  assert.throws(() => sumCents([Number.MAX_SAFE_INTEGER, 1]))
})
test("finance access is explicit; legacy staff and read-only roles do not inherit cashier privileges", () => {
  for (const role of ["OWNER", "MANAGER"] as const)
    for (const permission of [
      "payments:read",
      "payments:write",
      "payments:reverse",
      "reports:read",
    ] as const)
      assert.equal(can(role, permission), true)
  assert.equal(can("CASHIER", "payments:write"), true)
  assert.equal(can("CASHIER", "payments:reverse"), false)
  assert.equal(can("CASHIER", "reports:read"), false)
  for (const role of ["STAFF", "KITCHEN", "COURIER", "VIEWER"] as const)
    assert.equal(can(role, "payments:read"), false)
})
test("commands reject extra decimals, mass assignment, missing standalone description and oversized ranges", () => {
  const command = {
    requestId: randomUUID(),
    orderId: null,
    expectedPaid: 0,
    amount: "0,10",
    method: "CASH",
    description: "Balcão",
  }
  assert.equal(paymentInputSchema.safeParse(command).success, true)
  for (const patch of [
    { amount: "1,001" },
    { amount: "1e2" },
    { amount: "-10" },
    { description: "" },
    { tenantId: randomUUID() },
    { expectedPaid: 1 },
  ])
    assert.equal(paymentInputSchema.safeParse({ ...command, ...patch }).success, false)
  assert.equal(
    reportRangeSchema.safeParse({
      from: "2026-10-01T03:00:00.000Z",
      to: "2026-11-01T03:00:00.000Z",
    }).success,
    true,
  )
  assert.equal(
    reportRangeSchema.safeParse({
      from: "2026-10-01T03:00:00.000Z",
      to: "2026-11-02T03:00:00.000Z",
    }).success,
    false,
  )
})
test("reports separate sales from cash and count old reversals in the correct period", () => {
  const range = { from: "2026-10-18T03:00:00.000Z", to: "2026-10-19T03:00:00.000Z" }
  const base: PaymentView = {
    id: randomUUID(),
    orderId: null,
    amount: 100,
    method: "CASH",
    description: "Teste",
    recordedBy: randomUUID(),
    createdAt: range.from,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
  }
  const receipts = [
    base,
    {
      ...base,
      id: randomUUID(),
      amount: 300,
      createdAt: "2026-10-01T12:00:00.000Z",
      reversedAt: range.from,
      reversedBy: randomUUID(),
      reversalReason: "Teste",
    },
    { ...base, id: randomUUID(), amount: 999, createdAt: range.to },
  ]
  const order: ReportOrder = {
    id: randomUUID(),
    createdAt: "2026-10-19T02:59:59.000Z",
    status: "NEW",
    total: 1001,
    paid: 100,
    discount: 100,
    deliveryFee: 100,
    subtotal: 1001,
    fulfillment: "PICKUP",
  }
  const report = buildReport(
    range,
    [order, { ...order, id: randomUUID(), status: "CANCELLED" }],
    receipts,
    range.to,
  )
  assert.deepEqual(report.summary, {
    orders: 2,
    cancelled: 1,
    sales: 1001,
    discounts: 100,
    deliveryFees: 100,
    outstanding: 901,
    received: 100,
    reversed: 300,
    netReceived: -200,
  })
  assert.deepEqual(report.daily, [{ day: "2026-10-18", orders: 1, sales: 1001 }])
})
test("developer diagnostics discard arbitrary exception text and unapproved fields", async () => {
  const lines: string[] = []
  const logger = createDiagnostics(
    { level: "info", instance: "test" },
    {
      write: (value) => {
        lines.push(value)
      },
    },
  )
  logger.record({
    diagnosticId: randomUUID(),
    module: "payments",
    operation: "payments.record",
    code: "UNEXPECTED",
    timestamp: new Date().toISOString(),
    cause: "client@example.test password=secret",
    frames: ["payments.ts:12:4", "C:/Users/customer/private.txt"],
    errorType: "Error",
  })
  const output = lines.join("")
  assert.match(output, /payments.record/)
  assert.match(output, /payments.ts:12:4/)
  assert.doesNotMatch(output, /example.test|secret|customer|private.txt/)
  await logger.close()
})

test("a failing diagnostic destination cannot crash business or startup callbacks", async () => {
  const logger = createDiagnostics(
    { level: "info", instance: "test" },
    {
      write() {
        throw new Error("unavailable destination")
      },
    },
  )
  assert.doesNotThrow(() => logger.ready(3001))
  assert.doesNotThrow(() =>
    logger.http({
      requestId: "request-1",
      method: "GET",
      route: "/orders",
      status: 200,
      durationMs: 1,
    }),
  )
  assert.doesNotThrow(() =>
    logger.record({
      diagnosticId: randomUUID(),
      module: "payments",
      operation: "payments.record",
      code: "UNEXPECTED",
      timestamp: new Date().toISOString(),
      cause: "controlled_failure",
    }),
  )
  await logger.close()
})
