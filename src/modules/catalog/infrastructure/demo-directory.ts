import { Failure } from "../../../shared/domain/failure"

import type { RestaurantDirectory } from "../application/ports"

import { DEMO_RESTAURANT_ID, DEMO_SLUG } from "./legacy-migration"

export const demoDirectory: RestaurantDirectory = {
  async resolve(slug) {
    if (slug !== DEMO_SLUG) throw new Failure("NOT_FOUND", "Restaurante não encontrado.")

    return DEMO_RESTAURANT_ID
  },
}
