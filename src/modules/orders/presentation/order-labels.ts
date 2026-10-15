import type { OrderStatus } from "@cardapio/contracts"
export const orderLabels: Record<OrderStatus, string> = {
  NEW: "Novos",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Em entrega",
  COMPLETED: "Concluídos",
  CANCELLED: "Cancelados",
}
export const nextStep: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string }>
> = {
  NEW: { status: "PREPARING", label: "Iniciar preparo" },
  PREPARING: { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  OUT_FOR_DELIVERY: { status: "COMPLETED", label: "Concluir pedido" },
}
export function shortOrder(id: string) {
  return id.slice(0, 8).toUpperCase()
}
export function orderTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
