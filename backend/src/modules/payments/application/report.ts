import type {
  FinancialReport,
  PaymentView,
  ReportOrder,
  ReportRange,
} from "@cardapio/contracts"
import { paymentActivity, sumCents } from "@cardapio/domain/payments"

export function buildReport(
  range: ReportRange,
  orders: ReportOrder[],
  payments: PaymentView[],
  generatedAt: string,
): FinancialReport {
  return {
    range,
    generatedAt,
    orders,
    payments,
    ...summarizeReport(range, orders, payments),
  }
}

export type ReportOrderMetrics = Pick<
  ReportOrder,
  "createdAt" | "status" | "subtotal" | "discount" | "deliveryFee" | "total" | "paid"
>
export type ReportPaymentMetrics = Pick<
  PaymentView,
  "amount" | "method" | "createdAt" | "reversedAt"
>
export type ReportMetrics = Pick<FinancialReport, "summary" | "methods" | "daily">

export function summarizeReport(
  range: ReportRange,
  orders: readonly ReportOrderMetrics[],
  payments: readonly ReportPaymentMetrics[],
): ReportMetrics {
  const sales = orders.filter((o) => o.status !== "CANCELLED")
  const movements = payments.map((p) => ({
    method: p.method,
    ...paymentActivity(p, range),
  }))
  const received = sumCents(movements.map((p) => p.received))
  const reversed = sumCents(movements.map((p) => p.reversed))
  const days = new Map<string, { day: string; orders: number; sales: number }>()
  for (const order of sales) {
    const day = new Date(Date.parse(order.createdAt) - 3 * 3600000)
      .toISOString()
      .slice(0, 10)
    const bucket = days.get(day) ?? { day, orders: 0, sales: 0 }
    bucket.orders++
    bucket.sales = sumCents([bucket.sales, order.total])
    days.set(day, bucket)
  }
  return {
    summary: {
      orders: orders.length,
      cancelled: orders.length - sales.length,
      subtotal: sumCents(sales.map((o) => o.subtotal)),
      cancelledPaid: sumCents(
        orders.filter((o) => o.status === "CANCELLED").map((o) => o.paid),
      ),
      sales: sumCents(sales.map((o) => o.total)),
      discounts: sumCents(sales.map((o) => o.discount)),
      deliveryFees: sumCents(sales.map((o) => o.deliveryFee)),
      outstanding: sumCents(sales.map((o) => o.total - o.paid)),
      received,
      reversed,
      netReceived: received - reversed,
    },
    methods: (["PIX", "CASH", "DEBIT", "CREDIT", "OTHER"] as const).map((method) => ({
      method,
      received: sumCents(
        movements.filter((p) => p.method === method).map((p) => p.received),
      ),
      reversed: sumCents(
        movements.filter((p) => p.method === method).map((p) => p.reversed),
      ),
    })),
    daily: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}
