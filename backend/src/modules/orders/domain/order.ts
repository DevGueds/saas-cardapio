import { assertCents, parseMoney } from "@cardapio/domain/money"
import { brazilianPhone } from "@cardapio/domain/validation"
import type { OrderStatus, OrderView } from "@cardapio/contracts"
import { Failure, requireValid } from "@cardapio/domain/failure"
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
}
export function assertTransition(current: OrderStatus, next: OrderStatus) {
  if (!transitions[current].includes(next))
    throw new Failure(
      "CONFLICT",
      "Esta mudança de etapa não é permitida. Atualize os pedidos.",
    )
}

export function assertOrderSnapshot(order: OrderView) {
  requireValid(
    order.items.length > 0 && order.items.length <= 100,
    "Itens do pedido inválidos.",
  )
  brazilianPhone(order.customer.phone)
  const subtotal = order.items.reduce((sum, item) => {
    requireValid(
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 999,
      "Quantidade inválida.",
    )
    assertCents(item.unitPrice, "price", true)
    return sum + item.unitPrice * item.quantity
  }, 0)
  assertCents(subtotal, "subtotal", true)
  assertCents(order.total, "total", true)
  requireValid(
    subtotal === order.subtotal && order.total === subtotal + order.deliveryFee,
    "Valores do pedido inconsistentes.",
  )
  if (order.customer.payment === "Dinheiro" && order.customer.cashChange)
    requireValid(parseMoney(order.customer.cashChange) >= order.total, "Troco inválido.")
}
