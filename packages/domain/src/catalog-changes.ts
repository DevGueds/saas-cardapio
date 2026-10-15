import { Failure, requireValid } from "./failure.js"
import { parseMoney } from "./money.js"
import { normalizeName, text } from "./validation.js"
import { parseProduct } from "./catalog.js"
import type { MenuDocument } from "./menu-document.js"

export interface ProductInput {
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
export function saveProduct(
  current: MenuDocument,
  input: ProductInput,
  nextId: () => string,
): MenuDocument {
  if (input.id && !current.products.some((product) => product.id === input.id))
    throw new Failure("NOT_FOUND", "O produto foi removido. Atualize o catálogo.")
  const restaurantId = current.restaurant.id
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
    categoryId = nextId()
    categories.push({ id: categoryId, name, restaurantId })
  }
  requireValid(
    categories.some((category) => category.id === categoryId),
    "Selecione uma categoria existente.",
    "categoryId",
  )
  const product = parseProduct(
    {
      ...input,
      id: input.id ?? nextId(),
      restaurantId,
      categoryId,
      price: parseMoney(input.price, "price", true),
    },
    restaurantId,
  )
  return {
    ...current,
    categories,
    products: input.id
      ? current.products.map((item) => (item.id === input.id ? product : item))
      : [product, ...current.products],
  }
}
export function changeAvailability(
  current: MenuDocument,
  productId: string,
  available: boolean,
): MenuDocument {
  requireValid(typeof available === "boolean", "Disponibilidade inválida.")
  if (!current.products.some((product) => product.id === productId))
    throw new Failure("NOT_FOUND", "Produto não encontrado.")
  return {
    ...current,
    products: current.products.map((product) =>
      product.id === productId ? { ...product, available } : product,
    ),
  }
}
export function deleteProduct(current: MenuDocument, productId: string): MenuDocument {
  if (!current.products.some((product) => product.id === productId))
    throw new Failure("NOT_FOUND", "Produto não encontrado.")
  return {
    ...current,
    products: current.products.filter((product) => product.id !== productId),
  }
}
