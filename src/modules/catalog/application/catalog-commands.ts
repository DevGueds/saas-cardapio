import type { Executor } from "../../../shared/application/execute"

import type { AccessPolicy, IdGenerator } from "../../../shared/application/ports"

import { Failure, requireValid } from "../../../shared/domain/failure"

import { parseMoney } from "../../../shared/domain/money"

import { normalizeName, text } from "../../../shared/domain/validation"

import { parseProduct } from "../domain/catalog"

import type { MenuRepository } from "./ports"

export interface SaveProductInput {
  restaurantId: string
  expectedRevision: number
  id?: string

  name: string
  description: string
  price: string
  imageUrl: string

  categoryId: string
  newCategoryName?: string
  available: boolean
  popular: boolean
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

      if (input.id && !current.products.some((product) => product.id === input.id))
        throw new Failure("NOT_FOUND", "O produto foi removido. Atualize o catálogo.")

      let categoryId = input.categoryId

      const categories = [...current.categories]

      if (input.newCategoryName !== undefined) {
        const name = text(input.newCategoryName, "categoryName", 80, true)

        requireValid(
          !categories.some(
            (category) => normalizeName(category.name) === normalizeName(name),
          ),

          "Já existe uma categoria com esse nome. Selecione-a na lista.",
          "categoryName",
        )

        categoryId = this.ids.next()

        categories.push({
          id: categoryId,
          name,
          restaurantId: input.restaurantId,
        })
      }

      requireValid(
        categories.some((category) => category.id === categoryId),
        "Selecione uma categoria existente.",
        "categoryId",
      )

      const product = parseProduct(
        {
          ...input,
          id: input.id ?? this.ids.next(),

          categoryId,
          price: parseMoney(input.price, "price", true),
        },
        input.restaurantId,
      )

      const products = input.id
        ? current.products.map((item) => (item.id === input.id ? product : item))
        : [product, ...current.products]

      return this.repository.commit(input.restaurantId, input.expectedRevision, {
        ...current,
        categories,
        products,
      })
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

      const current = await this.repository.load(restaurantId)

      if (!current.products.some((product) => product.id === productId))
        throw new Failure("NOT_FOUND", "Produto não encontrado.")

      return this.repository.commit(restaurantId, expectedRevision, {
        ...current,

        products: current.products.map((product) =>
          product.id === productId ? { ...product, available } : product,
        ),
      })
    })
  }

  delete(restaurantId: string, expectedRevision: number, productId: string) {
    return this.executor.run("catalog", "delete-product", async () => {
      this.access.assertAdmin()

      const current = await this.repository.load(restaurantId)

      if (!current.products.some((product) => product.id === productId))
        throw new Failure("NOT_FOUND", "Produto não encontrado.")

      return this.repository.commit(
        restaurantId,
        expectedRevision,

        {
          ...current,
          products: current.products.filter((product) => product.id !== productId),
        },
      )
    })
  }
}
