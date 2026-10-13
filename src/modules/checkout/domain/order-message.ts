import type { Restaurant } from "../../restaurant/domain/restaurant"

import type { Product } from "../../catalog/domain/catalog"

import type { Cart } from "./cart"

import { formatMoney } from "../../../shared/domain/money"

export type Payment = "Pix" | "Cartão na Entrega" | "Dinheiro"

export interface DeliveryDetails {
  name: string
  phone: string
  address: string
  notes: string
  payment: Payment
  cashChange: string
}

export function orderMessage(
  menu: { restaurant: Restaurant; products: readonly Product[] },
  cart: Cart,

  customer: DeliveryDetails,
  subtotal: number,
  total: number,
  change?: number,
): string {
  const items = cart.lines.map((line) => {
    const product = menu.products.find((item) => item.id === line.productId)!

    return `${line.quantity}x ${product.name} — ${formatMoney(product.price * line.quantity)}${
      line.note.trim() ? `\n  Obs.: ${line.note.trim()}` : ""
    }`
  })

  return [
    `NOVO PEDIDO — ${menu.restaurant.name}`,
    "",
    "Itens do pedido:",
    ...items,
    "",

    `Subtotal: ${formatMoney(subtotal)}`,
    `Taxa de entrega: ${formatMoney(menu.restaurant.deliveryFee)}`,

    `TOTAL: ${formatMoney(total)}`,
    "",
    "Dados para entrega:",

    `Nome: ${customer.name}`,
    `WhatsApp: ${customer.phone}`,
    `Endereço: ${customer.address}`,

    `Pagamento: ${customer.payment}`,
    ...(change !== undefined ? [`Troco para: ${formatMoney(change)}`] : []),

    ...(customer.notes ? [`Observações: ${customer.notes}`] : []),
    "",
    "Pedido preparado pelo cardápio digital. Confirme o recebimento com a loja.",
  ].join("\n")
}
