import { Failure, requireValid } from "./failure.js"
import { parseMoney } from "./money.js"
import { normalizeName, text } from "./validation.js"
import { parseProduct } from "./catalog.js"
import type { MenuDocument } from "./menu-document.js"

export function saveCategory(
  current: MenuDocument,
  nameInput: string,
  id: string,
): MenuDocument {
  const name = text(nameInput, "name", 80, true)
  requireValid(
    !current.categories.some(
      (c) => c.id !== id && normalizeName(c.name) === normalizeName(name),
    ),
    "Já existe uma categoria com esse nome.",
    "name",
  )
  const category = { id, name, restaurantId: current.restaurant.id }
  return {
    ...current,
    categories: current.categories.some((c) => c.id === id)
      ? current.categories.map((c) => (c.id === id ? category : c))
      : [...current.categories, category],
  }
}
export function deleteCategory(current: MenuDocument, id: string): MenuDocument {
  if (!current.categories.some((c) => c.id === id))
    throw new Failure("NOT_FOUND", "Categoria não encontrada.")
  requireValid(
    !current.products.some((p) => p.categoryId === id),
    "Mova os produtos para outra categoria antes de excluir esta.",
  )
  return { ...current, categories: current.categories.filter((c) => c.id !== id) }
}

export interface ProductInput {
  addonGroupIds?: string[]
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
  const groups = current.commerce?.addonGroups ?? []
  if (input.addonGroupIds !== undefined)
    requireValid(
      Array.isArray(input.addonGroupIds) &&
        input.addonGroupIds.length <= 100 &&
        new Set(input.addonGroupIds).size === input.addonGroupIds.length &&
        input.addonGroupIds.every((id) => groups.some((group) => group.id === id)),
      "Escolha somente grupos de adicionais existentes.",
      "addonGroupIds",
    )
  return {
    ...current,
    ...(input.addonGroupIds !== undefined && current.commerce
      ? {
          commerce: {
            ...current.commerce,
            addonGroups: groups.map((group) => ({
              ...group,
              productIds: input.addonGroupIds!.includes(group.id)
                ? [...group.productIds.filter((id) => id !== product.id), product.id]
                : group.productIds.filter((id) => id !== product.id),
            })),
          },
        }
      : {}),
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
  requireValid(
    !current.commerce?.addonGroups?.some((g) => g.productIds.includes(productId)),
    "Este produto possui grupos de adicionais. Desvincule-o dos grupos antes de excluir.",
  )
  requireValid(
    !current.commerce?.combos.some(
      (c) =>
        c.items.some((i) => i.productId === productId) ||
        c.groups.some((g) => g.options.some((o) => o.productId === productId)),
    ),
    "Este produto faz parte de um combo. Remova-o do combo antes de excluir.",
  )
  if (!current.products.some((product) => product.id === productId))
    throw new Failure("NOT_FOUND", "Produto não encontrado.")
  return {
    ...current,
    products: current.products.filter((product) => product.id !== productId),
  }
}
