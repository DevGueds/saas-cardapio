import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { mkdir, writeFile } from "node:fs/promises"
import { buildReport } from "../backend/dist/modules/payments/application/report.js"
import { ParallelFinancialReports } from "../backend/dist/modules/payments/infrastructure/parallel-reports.js"
import { ParallelTaskRunner } from "../backend/dist/shared/infrastructure/parallel-task.js"

// No database, credentials or real personal data. Measures CPU isolation, not HTTP capacity.
const jobs = Number(process.env.BENCHMARK_CPU_JOBS ?? 12)
if (!Number.isInteger(jobs) || jobs < 2 || jobs > 50)
  throw new Error("BENCHMARK_CPU_JOBS must be an integer between 2 and 50")
const at = "2026-10-18T12:00:00.000Z"
const range = { from: "2026-10-18T03:00:00.000Z", to: "2026-10-19T03:00:00.000Z" }
const orders = Array.from({ length: 5000 }, (_, index) => ({
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: at,
  status: index % 10 === 0 ? "CANCELLED" : "COMPLETED",
  subtotal: 2002,
  deliveryFee: 200,
  discount: 102,
  total: 2100,
  paid: 1001,
  fulfillment: "DELIVERY",
}))
const payments = Array.from({ length: 5000 }, (_, index) => ({
  id: "00000000-0000-4000-8000-000000000002",
  orderId: orders[0].id,
  amount: 1001,
  method: "PIX",
  description: "",
  createdAt: at,
  recordedBy: "00000000-0000-4000-8000-000000000003",
  reversedAt: index % 10 === 0 ? at : null,
  reversedBy: index % 10 === 0 ? "00000000-0000-4000-8000-000000000003" : null,
  reversalReason: index % 10 === 0 ? "Teste sintético" : null,
}))
const reference = buildReport(range, orders, payments, at)
async function measure(run) {
  const delays = []
  let last = performance.now()
  const timer = setInterval(() => {
    const now = performance.now()
    delays.push(Math.max(0, now - last - 5))
    last = now
  }, 5)
  const start = performance.now()
  try {
    await run()
    const elapsedMs = performance.now() - start
    await new Promise((resolve) => setTimeout(resolve, 15))
    delays.sort((a, b) => a - b)
    return {
      elapsedMs: Math.round(elapsedMs),
      eventLoopDelayP99Ms: Math.round(
        delays[Math.max(0, Math.ceil(delays.length * 0.99) - 1)] ?? 0,
      ),
      eventLoopDelayMaxMs: Math.round(delays.at(-1) ?? 0),
    }
  } finally {
    clearInterval(timer)
  }
}
const inline = await measure(async () => {
  for (let index = 0; index < jobs; index++) {
    const result = buildReport(range, orders, payments, at)
    assert.equal(result.summary.netReceived, reference.summary.netReceived)
  }
})
const tasks = new ParallelTaskRunner(2)
const calculator = new ParallelFinancialReports(tasks, 2000)
let isolated
try {
  isolated = await measure(async () => {
    for (let index = 0; index < jobs; index += 2) {
      const results = await Promise.all(
        Array.from({ length: Math.min(2, jobs - index) }, () =>
          calculator.calculate(range, orders, payments, at),
        ),
      )
      for (const result of results) assert.deepEqual(result.summary, reference.summary)
    }
  })
  assert.equal(tasks.active, 0)
} finally {
  await tasks.close()
}
const result = {
  node: process.version,
  platform: process.platform,
  reports: jobs,
  ordersPerReport: orders.length,
  paymentsPerReport: payments.length,
  concurrentWorkers: 2,
  exactCents: true,
  inline,
  isolated,
}
await mkdir(".cache", { recursive: true })
await writeFile(".cache/benchmark-cpu.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result, null, 2))
