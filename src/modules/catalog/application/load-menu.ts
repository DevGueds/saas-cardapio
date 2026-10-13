import type { Executor } from "../../../shared/application/execute"

import type { AccessPolicy } from "../../../shared/application/ports"

import type { MenuRepository, RestaurantDirectory } from "./ports"

export class LoadMenu {
  constructor(
    private readonly repository: MenuRepository,
    private readonly directory: RestaurantDirectory,

    private readonly access: AccessPolicy,
    private readonly executor: Executor,
  ) {}

  subscribe(restaurantId: string, listener: () => void) {
    return this.repository.subscribe(restaurantId, listener)
  }

  execute(slug: string) {
    return this.executor.run("catalog", "load-menu", async () => {
      this.access.assertRead()

      const id = await this.directory.resolve(slug)

      return this.repository.load(id)
    })
  }
}
