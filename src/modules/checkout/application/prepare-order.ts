import type { CheckoutOptions } from "@cardapio/domain/quote"
import type { Result } from "../../../shared/application/result"
import type { Executor } from "../../../shared/application/execute"

import type { AccessPolicy } from "../../../shared/application/ports"

import { validateCheckout } from "@cardapio/domain/checkout"

import type { MenuRepository } from "../../catalog/application/ports"

import type { Cart } from "../domain/cart"

import type { DeliveryDetails } from "../domain/order-message"

export interface PreparedOrder {
  recovered?: boolean
  trackingToken?: string
  orderId?: string
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
    options?: CheckoutOptions,
  ): Promise<Result<PreparedOrder>> {
    return this.executor.run("checkout", "prepare-order", async () => {
      this.access.assertRead()

      const menu = await this.repository.load(restaurantId)

      const { phone, message } = validateCheckout(
        menu,
        restaurantId,
        expectedRevision,
        cart,
        input,
        options,
      )

      return {
        url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        revision: menu.revision,
      } satisfies PreparedOrder
    })
  }
}
