import type { OrderStatus } from "@cardapio/contracts"
export const orderLabels: Record<OrderStatus, string> = {
  NEW: "Novos",
  PREPARING: "Em preparo",
  READY: "Prontos",
  OUT_FOR_DELIVERY: "Em entrega",
  COMPLETED: "Concluídos",
  CANCELLED: "Cancelados",
}
export const nextStep: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string }>
> = {
  NEW: { status: "PREPARING", label: "Iniciar preparo" },
  PREPARING: { status: "READY", label: "Marcar como pronto" },
  READY: { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  OUT_FOR_DELIVERY: { status: "COMPLETED", label: "Concluir pedido" },
}
export function shortOrder(id: string) {
  return id.slice(0, 8).toUpperCase()
}
const orderDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})
export function orderTime(date: string) {
  return orderDateFormatter.format(new Date(date))
}

export function orderAction(order: import("@cardapio/contracts").OrderView) {
  return order.status === "READY" && order.fulfillment?.mode === "PICKUP"
    ? { status: "COMPLETED" as const, label: "Confirmar retirada" }
    : nextStep[order.status]
}
