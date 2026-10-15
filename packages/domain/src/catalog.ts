import { requireValid } from "./failure.js"

import { assertCents, type Cents } from "./money.js"

import {
  boolean,
  identifier,
  imageReference,
  normalizeName,
  record,
  text,
} from "./validation.js"

export type Category = Readonly<{
  id: string
  restaurantId: string
  name: string
}>

export type Product = Readonly<{
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string

  price: Cents
  imageUrl: string
  available: boolean
  popular: boolean
}>

export function parseCategory(input: unknown, restaurantId: string): Category {
  const data = record(input)

  requireValid(
    data.restaurantId === restaurantId,
    "A categoria não pertence a este restaurante.",
  )

  return {
    id: identifier(data.id),
    restaurantId,
    name: text(data.name, "categoryName", 80, true),
  }
}

export function parseProduct(input: unknown, restaurantId: string): Product {
  const data = record(input)

  requireValid(
    data.restaurantId === restaurantId,
    "O produto não pertence a este restaurante.",
  )

  assertCents(data.price, "price", true)

  return {
    id: identifier(data.id),
    restaurantId,
    categoryId: identifier(data.categoryId, "categoryId"),

    name: text(data.name, "name", 120, true),
    description: text(data.description, "description", 2000),

    price: data.price,
    imageUrl: imageReference(data.imageUrl),
    available: boolean(data.available, "available"),

    popular: boolean(data.popular, "popular"),
  }
}

export function validateCatalog(
  categories: readonly Category[],
  products: readonly Product[],
): void {
  requireValid(
    new Set(categories.map((category) => category.id)).size === categories.length,
    "Há identificadores de categoria duplicados.",
  )

  requireValid(
    new Set(categories.map((category) => normalizeName(category.name))).size ===
      categories.length,
    "Já existe uma categoria com esse nome.",
    "categoryName",
  )

  requireValid(
    new Set(products.map((product) => product.id)).size === products.length,
    "Há identificadores de produto duplicados.",
  )

  const ids = new Set(categories.map((category) => category.id))

  requireValid(
    products.every((product) => ids.has(product.categoryId)),
    "Selecione uma categoria existente.",
    "categoryId",
  )
}
