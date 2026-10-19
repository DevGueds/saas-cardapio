import type {
  FinancialReport,
  PaymentView,
  ReportOrder,
  ReportRange,
} from "@cardapio/contracts"
import { sumCents } from "@cardapio/domain/payments"

export function buildReport(
  range: ReportRange,
  orders: ReportOrder[],
  payments: PaymentView[],
  generatedAt: string,
): FinancialReport {
  const inside = (at: string) =>
    Date.parse(at) >= Date.parse(range.from) && Date.parse(at) < Date.parse(range.to)
  const sales = orders.filter((o) => o.status !== "CANCELLED")
  const receipts = payments.filter((p) => inside(p.createdAt))
  const reversals = payments.filter((p) => p.reversedAt && inside(p.reversedAt))
  const received = sumCents(receipts.map((p) => p.amount))
  const reversed = sumCents(reversals.map((p) => p.amount))
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
    range,
    generatedAt,
    orders,
    payments,
    summary: {
      orders: orders.length,
      cancelled: orders.length - sales.length,
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
        receipts.filter((p) => p.method === method).map((p) => p.amount),
      ),
      reversed: sumCents(
        reversals.filter((p) => p.method === method).map((p) => p.amount),
      ),
    })),
    daily: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}
