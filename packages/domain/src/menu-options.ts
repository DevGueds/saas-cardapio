import { requireValid } from "./failure.js"
import { assertCents } from "./money.js"
import { boolean, identifier, record, text } from "./validation.js"
import type { Product } from "./catalog.js"

export interface AddonOption {
  id: string
  name: string
  price: number
  available: boolean
  maxQuantity: number
}
export interface AddonGroup {
  id: string
  name: string
  active: boolean
  min: number
  max: number
  productIds: string[]
  options: AddonOption[]
}
export interface MenuAppearance {
  preset: "CLASSIC" | "EDITORIAL" | "COMPACT"
  color: "ORANGE" | "GREEN" | "BLUE" | "PLUM"
  showImages: boolean
  headline: string
}
export const defaultAppearance = (): MenuAppearance => ({
  preset: "CLASSIC",
  color: "GREEN",
  showImages: true,
  headline: "Seu próximo pedido começa aqui",
})
function count(value: unknown, min: number, max: number) {
  requireValid(
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max,
    `Informe uma quantidade entre ${min} e ${max}.`,
  )
  return value as number
}
function list(value: unknown, max: number): unknown[] {
  requireValid(
    Array.isArray(value) && value.length <= max,
    "Lista de adicionais inválida ou acima do limite.",
  )
  return value as unknown[]
}
export function parseAddonGroup(
  input: unknown,
  products: readonly Product[],
): AddonGroup {
  const v = record(input),
    min = count(v.min, 0, 20),
    max = count(v.max, Math.max(1, min), 20)
  const productIds = list(v.productIds, 500).map((value) => identifier(value))
  requireValid(
    new Set(productIds).size === productIds.length &&
      productIds.every((id) => products.some((p) => p.id === id)),
    "Selecione produtos desta loja, sem repetir.",
  )
  const options = list(v.options, 30).map((input) => {
    const o = record(input)
    assertCents(o.price, "price")
    return {
      id: identifier(o.id),
      name: text(o.name, "name", 80, true),
      price: o.price as number,
      available: boolean(o.available, "available"),
      maxQuantity: count(o.maxQuantity, 1, 20),
    }
  })
  requireValid(
    options.length > 0 && new Set(options.map((o) => o.id)).size === options.length,
    "Cadastre opções sem repetir identificadores.",
  )
  const active = boolean(v.active, "active")
  requireValid(
    !active ||
      options.filter((o) => o.available).reduce((s, o) => s + o.maxQuantity, 0) >= min,
    "As opções disponíveis precisam atender à quantidade mínima do grupo.",
  )
  return {
    id: identifier(v.id),
    name: text(v.name, "name", 80, true),
    active,
    min,
    max,
    productIds,
    options,
  }
}
export function parseAddonGroups(input: unknown, products: readonly Product[]) {
  const groups = list(input ?? [], 100).map((v) => parseAddonGroup(v, products))
  const ids = groups.flatMap((g) => [g.id, ...g.options.map((o) => o.id)])
  requireValid(
    new Set(ids).size === ids.length,
    "Identificador repetido entre grupos ou opções de adicionais.",
  )
  requireValid(
    products.every(
      (p) => groups.filter((g) => g.active && g.productIds.includes(p.id)).length <= 8,
    ),
    "Cada produto aceita até 8 grupos ativos de adicionais.",
  )
  return groups
}
export function parseAppearance(input: unknown): MenuAppearance {
  if (input === undefined || input === null) return defaultAppearance()
  const v = record(input)
  requireValid(
    ["CLASSIC", "EDITORIAL", "COMPACT"].includes(String(v.preset)),
    "Modelo de cardápio inválido.",
  )
  requireValid(
    ["ORANGE", "GREEN", "BLUE", "PLUM"].includes(String(v.color)),
    "Cor do cardápio inválida.",
  )
  return {
    preset: v.preset as MenuAppearance["preset"],
    color: v.color as MenuAppearance["color"],
    showImages: boolean(v.showImages, "showImages"),
    headline: text(v.headline, "headline", 120),
  }
}
export function priceAddons(
  groups: readonly AddonGroup[],
  productId: string,
  selections: Readonly<Record<string, number>> = {},
) {
  const applicable = groups.filter((g) => g.active && g.productIds.includes(productId)),
    allowed = new Set(applicable.flatMap((g) => g.options.map((o) => o.id)))
  requireValid(
    Object.keys(selections).length <= 60 &&
      Object.keys(selections).every((id) => allowed.has(id)),
    "Um adicional foi removido ou não pertence a este produto. Revise o carrinho.",
  )
  let extra = 0
  const components: string[] = []
  for (const group of applicable) {
    let total = 0
    for (const option of group.options) {
      if (!(option.id in selections)) continue
      const quantity = count(selections[option.id], 1, option.maxQuantity)
      requireValid(option.available, `O adicional ${option.name} está indisponível.`)
      total += quantity
      extra += quantity * option.price
      assertCents(extra, "addons")
      components.push(`${group.name}: ${quantity}× ${option.name}`)
    }
    requireValid(
      total >= group.min && total <= group.max,
      `${group.name}: escolha entre ${group.min} e ${group.max} adicionais.`,
    )
  }
  return { extra, components }
}
