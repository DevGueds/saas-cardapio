import type { MenuDocument } from "@cardapio/domain/menu-document"
import { normalizeName } from "@cardapio/domain/validation"
import { promotionActive } from "@cardapio/domain/quote"
export type DiscoveryFilter = "NONE" | "BEST_SELLERS" | "PROMOTIONS" | "CHEAPEST"
export function discoverProducts(
  menu: MenuDocument,
  selection: string | undefined,
  search: string,
  filter: DiscoveryFilter,
  ranking: readonly string[],
  now: number,
) {
  const hasPromotions =
    menu.commerce?.promotions.some((p) => promotionActive(p, now)) ?? false
  const products = menu.products.filter((product) => {
    if (
      search.trim()
        ? !normalizeName(`${product.name} ${product.description}`).includes(
            normalizeName(search),
          )
        : selection === "$popular"
          ? !product.popular
          : selection !== "$all" && product.categoryId !== selection
    )
      return false
    if (filter === "BEST_SELLERS")
      return product.available && ranking.includes(product.id)
    if (filter === "PROMOTIONS") return product.available && hasPromotions
    return true
  })
  if (filter === "BEST_SELLERS")
    products.sort((a, b) => ranking.indexOf(a.id) - ranking.indexOf(b.id))
  if (filter === "CHEAPEST")
    products.sort(
      (a, b) =>
        a.price - b.price ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    )
  return products
}
