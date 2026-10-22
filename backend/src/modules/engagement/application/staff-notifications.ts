import { can, type Role } from "@cardapio/domain/permissions"

/** One routing policy for the inbox and both phases of push delivery. */
export function staffNotificationFilter(role: Role, userId: string) {
  if (!can(role, "orders:read")) return { kind: "NONE" }
  if (role === "KITCHEN")
    return {
      kind: "ORDER",
      status: { in: ["NEW", "PREPARING", "READY", "CANCELLED"] },
    }
  if (role === "COURIER")
    return {
      kind: "ORDER",
      status: { in: ["ASSIGNED", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"] },
      order: { courierId: userId },
    }
  return {
    kind: {
      in: can(role, "payments:read") ? ["ORDER", "PAYMENT", "REVERSAL"] : ["ORDER"],
    },
  }
}

export function staffNotificationRelevant(
  role: Role,
  userId: string,
  event: { kind: string; status: string },
  order: { courierId: string | null },
) {
  const rule = staffNotificationFilter(role, userId)
  const kinds = typeof rule.kind === "string" ? [rule.kind] : rule.kind.in
  return (
    kinds.includes(event.kind) &&
    (!rule.status || rule.status.in.includes(event.status)) &&
    (!rule.order || rule.order.courierId === order.courierId)
  )
}

export function staffNotificationText(event: {
  kind: string
  status: string
  orderId: string
}) {
  const messages: Record<string, string> = {
    NEW: "Novo pedido recebido automaticamente. Abra os detalhes para conferir itens, adicionais e observações.",
    PREPARING:
      "Preparo iniciado. Confira os itens e as observações na comanda do pedido.",
    READY: "Pedido pronto. Organize a retirada ou a entrega e confira o responsável.",
    ASSIGNED:
      "Responsável pela entrega atualizado. Confira o pedido atribuído e as instruções de entrega.",
    OUT_FOR_DELIVERY: "Pedido em rota de entrega. Acompanhe a conclusão.",
    COMPLETED:
      "Pedido concluído. A etapa não confirma quitação; confira o financeiro se seu perfil permitir.",
    CANCELLED:
      "Pedido cancelado. Interrompa o preparo ou a entrega e confira as pendências com o atendimento.",
  }
  return {
    title: `Pedido #${event.orderId.slice(0, 8).toUpperCase()}`,
    message:
      event.kind === "PAYMENT"
        ? "Recebimento registrado. Confira o valor e o saldo pendente no financeiro do pedido."
        : event.kind === "REVERSAL"
          ? "Recebimento revertido pelo gerente. Confira o saldo atualizado; isso não faz estorno bancário."
          : (messages[event.status] ?? "Pedido atualizado. Consulte os detalhes."),
  }
}
