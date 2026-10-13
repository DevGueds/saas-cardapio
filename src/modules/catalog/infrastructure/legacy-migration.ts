import { Failure, requireValid } from "../../../shared/domain/failure"

import { legacyMoney } from "../../../shared/domain/money"

import { record } from "../../../shared/domain/validation"

import { parseMenuDocument, type MenuDocument } from "../application/menu-document"

import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_STORE } from "./demo-fixtures"

export const DEMO_RESTAURANT_ID = "demo-store"

export const DEMO_SLUG = "burger-house"

export const LEGACY_KEYS = [
  "saas_cardapio_store",
  "saas_cardapio_categories",
  "saas_cardapio_products",
] as const

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

// This is a one-way, explicit demo migration. Original keys are deliberately preserved.

export function initializeDemo(storage: StoragePort, restaurantId: string): MenuDocument {
  if (restaurantId !== DEMO_RESTAURANT_ID)
    throw new Failure("NOT_FOUND", "Restaurante não encontrado.")

  try {
    const storeRaw = storage.getItem(LEGACY_KEYS[0])

    const categoriesRaw = storage.getItem(LEGACY_KEYS[1])

    const productsRaw = storage.getItem(LEGACY_KEYS[2])

    const store = storeRaw === null ? INITIAL_STORE : record(JSON.parse(storeRaw))

    const categories: unknown =
      categoriesRaw === null ? INITIAL_CATEGORIES : JSON.parse(categoriesRaw)

    const products: unknown =
      productsRaw === null ? INITIAL_PRODUCTS : JSON.parse(productsRaw)

    requireValid(
      Array.isArray(categories) && Array.isArray(products),
      "Catálogo legado inválido.",
    )

    return parseMenuDocument(
      {
        schemaVersion: 1,
        revision: 0,

        restaurant: {
          ...store,
          whatsapp: store.whatsapp === INITIAL_STORE.whatsapp ? "" : store.whatsapp,
          slug: DEMO_SLUG,
          whatsappConfigured: false,

          deliveryFee: legacyMoney(store.deliveryFee),
          minOrder: legacyMoney(store.minOrder),
        },

        categories: categories.map((item) => ({
          ...record(item),
          restaurantId,
        })),

        products: products.map((item) => {
          const product = record(item)
          return {
            ...product,
            restaurantId,

            price: legacyMoney(product.price),
            popular: product.popular === undefined ? false : product.popular,
          }
        }),
      },
      restaurantId,
    )
  } catch (error: unknown) {
    if (error instanceof DOMException) throw error

    throw new Failure(
      "CORRUPT_DATA",
      "Os dados antigos são inválidos. Eles foram preservados; corrija-os antes de tentar novamente.",
      error instanceof Failure ? error.fields : {},
      error instanceof SyntaxError ? "legacy_json_invalid" : "legacy_schema_invalid",
    )
  }
}
