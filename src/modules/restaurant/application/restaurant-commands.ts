import type { Executor } from "../../../shared/application/execute"
import type { AccessPolicy } from "../../../shared/application/ports"
import type { MenuRepository } from "../../catalog/application/ports"
import {
  updateRestaurant,
  setRestaurantOpen,
  type RestaurantSettingsInput,
} from "@cardapio/domain/restaurant-changes"
export type { RestaurantSettingsInput } from "@cardapio/domain/restaurant-changes"
export class RestaurantCommands {
  constructor(
    private readonly repository: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly executor: Executor,
  ) {}
  update(restaurantId: string, expectedRevision: number, input: RestaurantSettingsInput) {
    return this.executor.run("restaurant", "update-settings", async () => {
      this.access.assertAdmin()
      return this.repository.commit(
        restaurantId,
        expectedRevision,
        updateRestaurant(await this.repository.load(restaurantId), input),
      )
    })
  }
  setOpen(restaurantId: string, expectedRevision: number, isOpen: boolean) {
    return this.executor.run("restaurant", "set-open", async () => {
      this.access.assertAdmin()
      return this.repository.commit(
        restaurantId,
        expectedRevision,
        setRestaurantOpen(await this.repository.load(restaurantId), isOpen),
      )
    })
  }
}
