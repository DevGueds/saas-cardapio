import type { Executor } from "../../../shared/application/execute"

import type { AccessPolicy } from "../../../shared/application/ports"

import { Failure, requireValid } from "../../../shared/domain/failure"

import { assertCents, parseMoney } from "../../../shared/domain/money"

import { brazilianPhone, text } from "../../../shared/domain/validation"

import type { MenuRepository } from "../../catalog/application/ports"

import { validateCart, type Cart } from "../domain/cart"

import { orderMessage, type DeliveryDetails } from "../domain/order-message"

export interface PreparedOrder {
  url: string
  revision: number
}

export class PrepareOrder {
  constructor(
    private readonly repository: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly executor: Executor,
  ) {}

  execute(
    restaurantId: string,
    expectedRevision: number,
    cart: Cart,
    input: DeliveryDetails,
  ) {
    return this.executor.run("checkout", "prepare-order", async () => {
      this.access.assertRead()

      const menu = await this.repository.load(restaurantId)

      if (menu.revision !== expectedRevision)
        throw new Failure(
          "CONFLICT",
          "Os dados da loja mudaram. Atualize o carrinho e tente novamente.",
        )

      requireValid(
        menu.restaurant.isOpen,
        "A loja está fechada e não está recebendo pedidos.",
      )

      const subtotal = validateCart(cart, restaurantId, menu.products)

      requireValid(
        subtotal >= menu.restaurant.minOrder,
        "O pedido está abaixo do valor mínimo da loja.",
      )

      requireValid(
        menu.restaurant.whatsappConfigured,
        "A loja ainda não configurou o WhatsApp para receber pedidos.",
      )

      const phone = brazilianPhone(menu.restaurant.whatsapp, "whatsapp")

      const customer: DeliveryDetails = {
        ...input,

        name: text(input.name, "name", 120, true),
        phone: brazilianPhone(input.phone, "phone"),

        address: text(input.address, "address", 500, true),
        notes: text(input.notes, "notes", 500),

        cashChange: text(input.cashChange, "cashChange", 30),
      }

      requireValid(
        ["Pix", "Cartão na Entrega", "Dinheiro"].includes(customer.payment),
        "Selecione uma forma de pagamento válida.",
        "payment",
      )

      cart.lines.forEach((line) => text(line.note, "note", 500))

      const total = subtotal + menu.restaurant.deliveryFee

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

      const message = orderMessage(menu, cart, customer, subtotal, total, change)

      return {
        url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        revision: menu.revision,
      } satisfies PreparedOrder
    })
  }
}
