import { requireValid } from "./failure.js"

import { record } from "./validation.js"

import { parseRestaurant, type Restaurant } from "./restaurant.js"

import {
  parseCategory,
  parseProduct,
  validateCatalog,
  type Category,
  type Product,
} from "./catalog.js"

export type MenuDocument = Readonly<{
  schemaVersion: 1
  revision: number
  restaurant: Restaurant

  categories: readonly Category[]
  products: readonly Product[]
}>

export function parseMenuDocument(input: unknown, restaurantId: string): MenuDocument {
  const data = record(input)

  requireValid(data.schemaVersion === 1, "Versão de dados não suportada.")

  requireValid(
    typeof data.revision === "number" &&
      Number.isSafeInteger(data.revision) &&
      data.revision >= 0,
    "Revisão inválida.",
  )

  const restaurant = parseRestaurant(data.restaurant)

  requireValid(
    restaurant.id === restaurantId,
    "Restaurante incompatível com os dados armazenados.",
  )

  requireValid(
    Array.isArray(data.categories) && Array.isArray(data.products),
    "Catálogo inválido.",
  )

  const categories = data.categories.map((item) => parseCategory(item, restaurantId))

  const products = data.products.map((item) => parseProduct(item, restaurantId))

  validateCatalog(categories, products)

  return {
    schemaVersion: 1,
    revision: data.revision,
    restaurant,
    categories,
    products,
  }
}
