import { Failure, requireValid } from "./failure.js"
import { assertCents } from "./money.js"

export function assertPaymentBalance(
  total: number,
  paid: number,
  amount: number,
  expectedPaid: number,
) {
  assertCents(total, "total")
  assertCents(paid, "paid")
  assertCents(amount, "amount", true)
  if (paid !== expectedPaid)
    throw new Failure(
      "CONFLICT",
      "O saldo mudou. Atualize o pedido antes de registrar o pagamento.",
    )
  requireValid(
    amount <= total - paid,
    "O valor supera o saldo em aberto do pedido.",
    "amount",
  )
}

/** Reporting totals may exceed a single MySQL INT; all arithmetic remains integral. */
export function sumCents(values: readonly number[]): number {
  let total = 0
  for (const value of values) {
    requireValid(Number.isSafeInteger(value), "Valor financeiro inválido.")
    total += value
    requireValid(Number.isSafeInteger(total), "O total excede o limite permitido.")
  }
  return total
}

/** Receipt and reversal are separate movements; the end of the range is exclusive. */
export function paymentActivity(
  payment: { amount: number; createdAt: string; reversedAt: string | null },
  range: { from: string; to: string },
) {
  assertCents(payment.amount, "amount", true)
  const from = Date.parse(range.from),
    to = Date.parse(range.to)
  requireValid(
    Number.isFinite(from) && Number.isFinite(to) && from < to,
    "Período financeiro inválido.",
  )
  const inside = (at: string | null) =>
    at !== null && Date.parse(at) >= from && Date.parse(at) < to
  const received = inside(payment.createdAt) ? payment.amount : 0
  const reversed = inside(payment.reversedAt) ? payment.amount : 0
  return { received, reversed, net: received - reversed }
}
