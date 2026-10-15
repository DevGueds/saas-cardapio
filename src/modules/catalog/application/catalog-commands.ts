import type { Executor } from "../../../shared/application/execute"
import type { AccessPolicy, IdGenerator } from "../../../shared/application/ports"
import {
  saveProduct,
  changeAvailability,
  deleteProduct,
  type ProductInput,
} from "@cardapio/domain/catalog-changes"
import type { MenuRepository } from "./ports"
export interface SaveProductInput extends ProductInput {
  restaurantId: string
  expectedRevision: number
}
export class CatalogCommands {
  constructor(
    private readonly repository: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly ids: IdGenerator,
    private readonly executor: Executor,
  ) {}
  save(input: SaveProductInput) {
    return this.executor.run("catalog", "save-product", async () => {
      this.access.assertAdmin()
      const current = await this.repository.load(input.restaurantId)
      return this.repository.commit(
        input.restaurantId,
        input.expectedRevision,
        saveProduct(current, input, () => this.ids.next()),
      )
    })
  }
  setAvailability(
    restaurantId: string,
    expectedRevision: number,
    productId: string,
    available: boolean,
  ) {
    return this.executor.run("catalog", "set-availability", async () => {
      this.access.assertAdmin()
      return this.repository.commit(
        restaurantId,
        expectedRevision,
        changeAvailability(
          await this.repository.load(restaurantId),
          productId,
          available,
        ),
      )
    })
  }
  delete(restaurantId: string, expectedRevision: number, productId: string) {
    return this.executor.run("catalog", "delete-product", async () => {
      this.access.assertAdmin()
      return this.repository.commit(
        restaurantId,
        expectedRevision,
        deleteProduct(await this.repository.load(restaurantId), productId),
      )
    })
  }
}
