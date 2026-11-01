import type { MenuDocument } from "@cardapio/domain/menu-document"
import { normalizeName } from "@cardapio/domain/validation"
import { promotionActive } from "@cardapio/domain/quote"
export type DiscoveryFilter = "NONE" | "BEST_SELLERS" | "PROMOTIONS"
export function discoverProducts(
  menu: MenuDocument,
  selection: string | undefined,
  search: string,
  filter: DiscoveryFilter,
  ranking: readonly string[],
  now: number,
) {
  const query = normalizeName(search)
  const ranks = new Map(ranking.map((id, index) => [id, index]))
  const hasPromotions =
    menu.commerce?.promotions.some((p) => promotionActive(p, now)) ?? false
  const products = menu.products.filter((product) => {
    if (
      query
        ? !normalizeName(`${product.name} ${product.description}`).includes(query)
        : selection === "$popular"
          ? !product.popular
          : selection !== "$all" && product.categoryId !== selection
    )
      return false
    if (filter === "BEST_SELLERS") return product.available && ranks.has(product.id)
    if (filter === "PROMOTIONS") return product.available && hasPromotions
    return true
  })
  if (filter === "BEST_SELLERS")
    products.sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!)
  else
    products.sort(
      (a, b) =>
        a.price - b.price ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    )
  return products
}
