import type { Executor } from "../../../shared/application/execute"

import type { AccessPolicy } from "../../../shared/application/ports"

import { parseMoney } from "../../../shared/domain/money"

import { brazilianPhone, text } from "../../../shared/domain/validation"

import type { MenuRepository } from "../../catalog/application/ports"

import { parseRestaurant } from "../domain/restaurant"

export interface RestaurantSettingsInput {
  name: string
  description: string
  whatsapp: string
  address: string

  logoUrl: string
  coverUrl: string
  deliveryFee: string
  minOrder: string
  eta: string
}

export class RestaurantCommands {
  constructor(
    private readonly repository: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly executor: Executor,
  ) {}

  update(restaurantId: string, expectedRevision: number, input: RestaurantSettingsInput) {
    return this.executor.run("restaurant", "update-settings", async () => {
      this.access.assertAdmin()

      const current = await this.repository.load(restaurantId)

      const whatsapp = text(input.whatsapp, "whatsapp", 30)

      const restaurant = parseRestaurant({
        ...current.restaurant,

        name: input.name,
        description: input.description,
        address: input.address,

        logoUrl: input.logoUrl,
        coverUrl: input.coverUrl,
        eta: input.eta,

        whatsapp: whatsapp ? brazilianPhone(whatsapp, "whatsapp") : "",
        whatsappConfigured: whatsapp !== "",

        deliveryFee: parseMoney(input.deliveryFee, "deliveryFee"),
        minOrder: parseMoney(input.minOrder, "minOrder"),
      })

      return this.repository.commit(restaurantId, expectedRevision, {
        ...current,
        restaurant,
      })
    })
  }

  setOpen(restaurantId: string, expectedRevision: number, isOpen: boolean) {
    return this.executor.run("restaurant", "set-open", async () => {
      this.access.assertAdmin()

      const current = await this.repository.load(restaurantId)

      return this.repository.commit(
        restaurantId,
        expectedRevision,

        {
          ...current,
          restaurant: parseRestaurant({ ...current.restaurant, isOpen }),
        },
      )
    })
  }
}
