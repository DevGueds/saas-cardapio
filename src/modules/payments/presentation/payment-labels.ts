import type { PaymentMethod, ReportRange } from "@cardapio/contracts"
export const paymentLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT: "Cartão de débito",
  CREDIT: "Cartão de crédito",
  OTHER: "Outro",
}
export function financeTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}
export const today = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)
export function dateRange(from: string, to: string): ReportRange {
  return {
    from: new Date(`${from}T00:00:00-03:00`).toISOString(),
    to: new Date(Date.parse(`${to}T00:00:00-03:00`) + 86400000).toISOString(),
  }
}
