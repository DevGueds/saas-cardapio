import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Failure } from "@cardapio/domain/failure"
import type { PaymentView, ReportOrder } from "@cardapio/contracts"
import { ParallelTaskRunner } from "../../src/shared/infrastructure/parallel-task.js"
import { ParallelFinancialReports } from "../../src/modules/payments/infrastructure/parallel-reports.js"
import { buildReport } from "../../src/modules/payments/application/report.js"

test("Parallel.js runs in a separate bounded process without application environment secrets", async () => {
  const runner = new ParallelTaskRunner(1)
  process.env.PARALLEL_CANARY = "private-test-value"
  try {
    const result = (await runner.run(21, function (input) {
      return {
        value: Number(input) * 2,
        pid: process.pid,
        hasSecret: !!(
          process.env.PARALLEL_CANARY ||
          process.env.DATABASE_URL ||
          process.env.SESSION_SECRET
        ),
        heap: process.getBuiltinModule("v8").getHeapStatistics().heap_size_limit,
      }
    })) as { value: number; pid: number; hasSecret: boolean; heap: number }
    assert.equal(result.value, 42)
    assert.notEqual(result.pid, process.pid)
    assert.equal(result.hasSecret, false)
    assert.ok(result.heap < 110 * 1024 * 1024)
    assert.equal(runner.active, 0)
  } finally {
    delete process.env.PARALLEL_CANARY
    await runner.close()
  }
})

test("CPU saturation and deadlines reject safely, kill the job and release capacity", async () => {
  const runner = new ParallelTaskRunner(1, 600)
  try {
    const busy = runner.run(null, function () {
      for (;;) {
        /* deliberate CPU fault, isolated child only */
      }
    })
    const failed = assert.rejects(
      busy,
      (error: unknown) =>
        error instanceof Failure && error.technicalCause === "parallel_timeout",
    )
    await assert.rejects(
      runner.run(1, (value) => value),
      (error: unknown) =>
        error instanceof Failure && error.technicalCause === "concurrency_limit",
    )
    let yielded = false
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        yielded = true
        resolve()
      }, 20),
    )
    assert.equal(yielded, true)
    await failed
    assert.equal(runner.active, 0)
    assert.equal(await runner.run(1, (value) => value), 1)
  } finally {
    await runner.close()
  }
})

test("early worker exit, exceptions, invalid serialization and shutdown never strand a request", async () => {
  const runner = new ParallelTaskRunner(1)
  await assert.rejects(
    runner.run(null, function () {
      process.exit(9)
    }),
    (error: unknown) =>
      error instanceof Failure && error.technicalCause === "parallel_worker_exited",
  )
  await assert.rejects(
    runner.run(null, function () {
      throw new Error("test-only")
    }),
    (error: unknown) => error instanceof Failure,
  )
  await assert.rejects(runner.run("x".repeat(2_000_001), (value) => value))
  assert.equal(runner.active, 0)
  const pending = runner.run(null, function () {
    for (;;) {
      /* deliberate CPU fault */
    }
  })
  const failed = assert.rejects(pending, (error: unknown) => error instanceof Failure)
  await runner.close()
  await failed
  assert.equal(runner.active, 0)
  await assert.rejects(
    runner.run(1, (value) => value),
    (error: unknown) =>
      error instanceof Failure && error.technicalCause === "parallel_closed",
  )
})

const range = { from: "2026-10-18T03:00:00.000Z", to: "2026-10-19T03:00:00.000Z" }
const at = "2026-10-18T12:00:00.000Z"
function fixtures() {
  const order: ReportOrder = {
    id: randomUUID(),
    createdAt: at,
    status: "COMPLETED",
    subtotal: 2002,
    deliveryFee: 200,
    discount: 102,
    total: 2100,
    paid: 1001,
    fulfillment: "DELIVERY",
  }
  const payment: PaymentView = {
    id: randomUUID(),
    orderId: order.id,
    amount: 1001,
    method: "PIX",
    description: "private description",
    createdAt: at,
    recordedBy: randomUUID(),
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
  }
  return {
    orders: [order, { ...order, id: randomUUID(), status: "CANCELLED" as const }],
    payments: [
      payment,
      {
        ...payment,
        id: randomUUID(),
        amount: 101,
        createdAt: "2026-10-01T12:00:00.000Z",
        reversedAt: at,
        reversedBy: randomUUID(),
        reversalReason: "private reason",
      },
    ],
  }
}

test("parallel financial arithmetic matches the reference with exact cents, cancellations and old reversals", async () => {
  const runner = new ParallelTaskRunner(2),
    calculator = new ParallelFinancialReports(runner, 1)
  try {
    const { orders, payments } = fixtures()
    const result = await calculator.calculate(range, orders, payments, at)
    assert.deepEqual(result, buildReport(range, orders, payments, at))
    assert.equal(result.summary.netReceived, 900)
    assert.equal(result.summary.sales, 2100)
    const manyOrders = Array.from({ length: 5000 }, (_, index) => ({
        ...orders[index % orders.length]!,
      })),
      manyPayments = Array.from({ length: 5000 }, (_, index) => ({
        ...payments[index % payments.length]!,
      }))
    assert.deepEqual(
      await calculator.calculate(range, manyOrders, manyPayments, at),
      buildReport(range, manyOrders, manyPayments, at),
    )
    assert.equal(runner.active, 0)
  } finally {
    await runner.close()
  }
})

test("report workers receive only arithmetic fields and malformed output cannot become a financial report", async () => {
  const { orders, payments } = fixtures()
  const expected = buildReport(range, orders, payments, at)
  let captured: unknown
  const calculator = new ParallelFinancialReports(
    {
      run: async (input) => {
        captured = input
        return {
          summary: expected.summary,
          methods: expected.methods,
          daily: expected.daily,
        }
      },
    },
    1,
  )
  await calculator.calculate(range, orders, payments, at)
  const json = JSON.stringify(captured)
  for (const forbidden of [
    "private description",
    "private reason",
    "recordedBy",
    "reversedBy",
    orders[0]!.id,
  ])
    assert.equal(json.includes(forbidden), false)
  const invalid = new ParallelFinancialReports(
    { run: async () => ({ summary: { sales: 0.1 } }) },
    1,
  )
  await assert.rejects(
    invalid.calculate(range, orders, payments, at),
    (error: unknown) => error instanceof Failure && error.code === "CORRUPT_DATA",
  )
})
