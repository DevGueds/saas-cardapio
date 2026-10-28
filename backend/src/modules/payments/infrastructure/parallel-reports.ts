import { fileURLToPath } from "node:url"
import {
  financialReportSchema,
  type FinancialReport,
  type PaymentView,
  type ReportOrder,
  type ReportRange,
} from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import {
  buildReport,
  type ReportOrderMetrics,
  type ReportPaymentMetrics,
} from "../application/report.js"
import type { FinancialReportCalculator } from "../application/ports.js"
import type { ParallelTaskRunner } from "../../../shared/infrastructure/parallel-task.js"

interface MetricsTask {
  range: ReportRange
  orders: ReportOrderMetrics[]
  payments: ReportPaymentMetrics[]
}
const metricsSchema = financialReportSchema.pick({
  summary: true,
  methods: true,
  daily: true,
})

/** Serialized by Parallel.js; no lexical imports, caller code, credentials or database. */
function computeMetrics(input: unknown) {
  const data = input as MetricsTask
  const scope = globalThis as typeof globalThis & { env: { modulePath: string } }
  const load = process.getBuiltinModule("module").createRequire(scope.env.modulePath)
  const kernel = load(scope.env.modulePath) as typeof import("../application/report.js")
  return kernel.summarizeReport(data.range, data.orders, data.payments)
}

export class ParallelFinancialReports implements FinancialReportCalculator {
  constructor(
    private readonly tasks: Pick<ParallelTaskRunner, "run">,
    private readonly threshold = 2000,
  ) {
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10000)
      throw new Error("invalid_report_threshold")
  }
  async calculate(
    range: ReportRange,
    orders: ReportOrder[],
    payments: PaymentView[],
    generatedAt: string,
  ): Promise<FinancialReport> {
    if (orders.length + payments.length < this.threshold)
      return buildReport(range, orders, payments, generatedAt)
    // Project only the data needed for arithmetic. Names, descriptions, IDs,
    // sessions and customer/employee details stay in the authorized API process.
    const input: MetricsTask = {
      range,
      orders: orders.map(
        ({ createdAt, status, subtotal, discount, deliveryFee, total, paid }) => ({
          createdAt,
          status,
          subtotal,
          discount,
          deliveryFee,
          total,
          paid,
        }),
      ),
      payments: payments.map(({ amount, method, createdAt, reversedAt }) => ({
        amount,
        method,
        createdAt,
        reversedAt,
      })),
    }
    const result = await this.tasks.run(input, computeMetrics, {
      modulePath: fileURLToPath(new URL("../application/report.js", import.meta.url)),
    })
    const metrics = metricsSchema.safeParse(result)
    if (!metrics.success)
      throw new Failure(
        "CORRUPT_DATA",
        "Não foi possível validar os totais do relatório. Tente novamente.",
        {},
        "parallel_report_invalid",
      )
    return { range, generatedAt, orders, payments, ...metrics.data }
  }
}
