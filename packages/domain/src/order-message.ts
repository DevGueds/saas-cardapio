import type { Quote } from "./quote.js"
import type { Restaurant } from "./restaurant.js"

import type { Product } from "./catalog.js"

import type { Cart } from "./cart.js"

import { formatMoney } from "./money.js"

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
  quote?: Quote,
): string {
  const lines =
    quote?.items ??
    cart.lines.map((line) => ({
      ...line,
      name: menu.products.find((p) => p.id === line.productId)!.name,
      components: [] as string[],
    }))
  const items = lines.map(
    (line) =>
      `${line.quantity}x ${line.name} — ${formatMoney(line.unitPrice * line.quantity)}${line.components?.length ? "\n  " + line.components.join("; ") : ""}${line.note.trim() ? `\n  Obs.: ${line.note.trim()}` : ""}`,
  )

  return [
    `NOVO PEDIDO — ${menu.restaurant.name}`,
    "",
    "Itens do pedido:",
    ...items,
    "",

    `Subtotal: ${formatMoney(subtotal)}`,
    `Taxa de entrega: ${formatMoney(quote?.deliveryFee ?? menu.restaurant.deliveryFee)}`,

    ...(quote?.discount
      ? [`Desconto (${quote.promotionName}): -${formatMoney(quote.discount)}`]
      : []),
    ...(quote
      ? [
          `Modalidade: ${quote.fulfillment.mode === "PICKUP" ? "Retirada" : "Entrega"}`,
          `Região: ${quote.region}`,
          `Prazo estimado: ${quote.eta}`,
        ]
      : []),
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
