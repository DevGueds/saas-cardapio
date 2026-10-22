import type { NotificationView } from "@cardapio/contracts"
import { staffNotificationText } from "./staff-notifications.js"
export function notificationText(event: {
  kind: string
  status: string
  orderId: string
}) {
  const code = event.orderId.slice(0, 8).toUpperCase()
  const states: Record<string, string> = {
    NEW: "Pedido recebido pela loja.",
    PREPARING: "Seu pedido está em preparo.",
    READY: "Seu pedido está pronto.",
    OUT_FOR_DELIVERY: "Seu pedido saiu para entrega.",
    COMPLETED: "Pedido concluído. Obrigado!",
    CANCELLED: "Pedido cancelado. Fale com a loja se precisar de ajuda.",
  }
  return {
    title: `Pedido #${code}`,
    message:
      event.kind === "PAYMENT"
        ? "A loja registrou um recebimento para este pedido. Para conferir o valor ou saldo pendente, fale com a loja."
        : event.kind === "REVERSAL"
          ? "Um registro de pagamento foi revertido pelo gerente. Consulte a loja para conferir o saldo."
          : (states[event.status] ?? "Seu pedido foi atualizado."),
  }
}
export function notificationView(event: {
  id: string
  orderId: string
  kind: string
  status: string
  createdAt: Date
}): NotificationView {
  return {
    id: event.id,
    orderId: event.orderId,
    kind: event.kind as NotificationView["kind"],
    ...staffNotificationText(event),
    createdAt: event.createdAt.toISOString(),
  }
}
