import type { Quote } from "./quote.js"
import type { Restaurant } from "./restaurant.js"

import type { Product } from "./catalog.js"

import type { Cart } from "./cart.js"

import { formatMoney } from "./money.js"
import type { DeliveryAddress } from "./delivery-address.js"

export type Payment = "Pix" | "Cartão na Entrega" | "Dinheiro"

export interface DeliveryDetails {
  name: string
  phone: string
  address: string
  deliveryAddress?: DeliveryAddress
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
      `• ${line.quantity}x ${whatsappInline(line.name)} — *${formatMoney(line.unitPrice * line.quantity)}*${line.components?.length ? "\n  " + line.components.map(whatsappInline).join("; ") : ""}${line.note.trim() ? `\n  Obs.: ${whatsappInline(line.note)}` : ""}`,
  )

  return [
    `*PEDIDO — ${whatsappInline(menu.restaurant.name)}*`,
    "",
    "*Itens do pedido*",
    ...items,
    "",

    `Subtotal: ${formatMoney(subtotal)}`,
    `Taxa de entrega: ${formatMoney(quote?.deliveryFee ?? menu.restaurant.deliveryFee)}`,

    ...(quote?.discount
      ? [
          `Desconto (${whatsappInline(quote.promotionName ?? "Promoção")}): -${formatMoney(quote.discount)}`,
        ]
      : []),
    ...(quote
      ? [
          `Modalidade: ${quote.fulfillment.mode === "PICKUP" ? "Retirada" : "Entrega"}`,
          ...(quote.fulfillment.mode === "DELIVERY"
            ? [`Região: ${whatsappInline(quote.region)}`]
            : []),
          `Prazo estimado: ${whatsappInline(quote.eta)}`,
        ]
      : []),
    `*TOTAL: ${formatMoney(total)}*`,
    "",
    quote?.fulfillment.mode === "PICKUP"
      ? "*Retirada no estabelecimento*"
      : "*Dados para entrega*",

    `Nome: ${whatsappInline(customer.name)}`,
    `WhatsApp: ${customer.phone}`,
    ...(quote?.fulfillment.mode === "PICKUP"
      ? []
      : [`Endereço: ${whatsappInline(customer.address)}`]),

    `Forma de pagamento escolhida: ${customer.payment}`,
    ...(change !== undefined ? [`Troco para: ${formatMoney(change)}`] : []),

    ...(customer.notes ? [`Observações: ${whatsappInline(customer.notes)}`] : []),
    "",
    "A forma de pagamento escolhida não confirma quitação.",
  ].join("\n")
}

/** Preserve content while preventing free text from changing the message hierarchy. */
export function whatsappInline(value: string) {
  return value
    .replace(/[*_~`\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
