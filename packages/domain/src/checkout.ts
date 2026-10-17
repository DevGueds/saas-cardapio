import { quoteOrder, type CheckoutOptions } from "./quote.js"
import { Failure, requireValid } from "./failure.js"
import { assertCents, parseMoney } from "./money.js"
import { brazilianPhone, text } from "./validation.js"
import { type Cart } from "./cart.js"
import { orderMessage, type DeliveryDetails } from "./order-message.js"
import type { MenuDocument } from "./menu-document.js"

export function validateCheckout(
  menu: MenuDocument,
  restaurantId: string,
  expectedRevision: number,
  cart: Cart,
  input: DeliveryDetails,
  options: CheckoutOptions & { requireWhatsapp?: boolean; now?: number } = {},
) {
  if (menu.revision !== expectedRevision)
    throw new Failure(
      "CONFLICT",
      "Os dados da loja mudaram. Atualize o carrinho e tente novamente.",
    )

  requireValid(
    menu.restaurant.isOpen,
    "A loja está fechada e não está recebendo pedidos.",
  )

  requireValid(restaurantId === menu.restaurant.id, "Carrinho de outra loja.")
  const quote = quoteOrder(menu, cart, options, options.now)
  const { subtotal, total } = quote

  requireValid(
    subtotal >= menu.restaurant.minOrder,
    "O pedido está abaixo do valor mínimo da loja.",
  )

  requireValid(
    options.requireWhatsapp === false || menu.restaurant.whatsappConfigured,
    "A loja ainda não configurou o WhatsApp para receber pedidos.",
  )

  const phone = menu.restaurant.whatsappConfigured
    ? brazilianPhone(menu.restaurant.whatsapp, "whatsapp")
    : ""

  const customer: DeliveryDetails = {
    ...input,

    name: text(input.name, "name", 120, true),
    phone: brazilianPhone(input.phone, "phone"),

    address:
      quote.fulfillment.mode === "PICKUP"
        ? "Retirada na loja"
        : text(input.address, "address", 500, true),
    notes: text(input.notes, "notes", 500),

    cashChange: text(input.cashChange, "cashChange", 30),
  }

  requireValid(
    ["Pix", "Cartão na Entrega", "Dinheiro"].includes(customer.payment),
    "Selecione uma forma de pagamento válida.",
    "payment",
  )

  cart.lines.forEach((line) => text(line.note, "note", 500))

  assertCents(total, "total")

  const change =
    customer.payment === "Dinheiro" && customer.cashChange
      ? parseMoney(customer.cashChange, "cashChange", true)
      : undefined

  requireValid(
    change === undefined || change >= total,
    "O valor para troco deve cobrir o total do pedido.",
    "cashChange",
  )

  return {
    quote,
    customer,
    subtotal,
    total,
    change,
    phone,
    message: orderMessage(menu, cart, customer, subtotal, total, change, quote),
  }
}
