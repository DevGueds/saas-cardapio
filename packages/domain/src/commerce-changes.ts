import { Failure, requireValid } from "./failure.js"
import {
  emptyCommerce,
  parseCombo,
  parseCommerce,
  parseDelivery,
  parsePromotion,
  type Combo,
  type Promotion,
  type DeliverySettings,
} from "./commerce.js"
import type { MenuDocument } from "./menu-document.js"
import {
  parseAddonGroup,
  parseAppearance,
  type AddonGroup,
  type MenuAppearance,
} from "./menu-options.js"
export function saveAddon(menu: MenuDocument, input: AddonGroup): MenuDocument {
  const commerce = menu.commerce ?? emptyCommerce()
  return {
    ...menu,
    commerce: parseCommerce(
      {
        ...commerce,
        addonGroups: replace(
          commerce.addonGroups ?? [],
          parseAddonGroup(input, menu.products),
        ),
      },
      menu.products,
    ),
  }
}
export function saveAppearance(
  menu: MenuDocument,
  appearance: MenuAppearance,
): MenuDocument {
  return {
    ...menu,
    commerce: {
      ...(menu.commerce ?? emptyCommerce()),
      appearance: parseAppearance(appearance),
    },
  }
}
export function removeAddon(menu: MenuDocument, id: string): MenuDocument {
  const commerce = menu.commerce ?? emptyCommerce()
  requireValid(
    !!commerce.addonGroups?.some((g) => g.id === id),
    "Grupo não encontrado. Atualize a lista.",
  )
  return {
    ...menu,
    commerce: {
      ...commerce,
      addonGroups: commerce.addonGroups!.filter((g) => g.id !== id),
    },
  }
}
function replace<T extends { id: string }>(items: T[], value: T) {
  return items.some((i) => i.id === value.id)
    ? items.map((i) => (i.id === value.id ? value : i))
    : [...items, value]
}
export function saveCombo(menu: MenuDocument, input: Combo): MenuDocument {
  const commerce = menu.commerce ?? emptyCommerce(),
    combo = parseCombo(input, menu.products)
  return {
    ...menu,
    commerce: parseCommerce(
      { ...commerce, combos: replace(commerce.combos, combo) },
      menu.products,
    ),
  }
}
export function savePromotion(
  menu: MenuDocument,
  input: Omit<Promotion, "used">,
): MenuDocument {
  const commerce = menu.commerce ?? emptyCommerce(),
    old = commerce.promotions.find((p) => p.id === input.id)
  const promotion = parsePromotion({ ...input, used: old?.used ?? 0 })
  return {
    ...menu,
    commerce: parseCommerce(
      { ...commerce, promotions: replace(commerce.promotions, promotion) },
      menu.products,
    ),
  }
}
export function saveDelivery(menu: MenuDocument, input: DeliverySettings): MenuDocument {
  const delivery = parseDelivery(input)
  requireValid(
    delivery.enabled || delivery.pickupEnabled,
    "Ative entrega ou retirada para receber pedidos.",
  )
  requireValid(
    !delivery.enabled ||
      delivery.mode !== "ZONES" ||
      delivery.zones.some((z) => z.active),
    "Cadastre pelo menos um bairro ativo antes de ativar o frete por região.",
  )
  return { ...menu, commerce: { ...(menu.commerce ?? emptyCommerce()), delivery } }
}
export function removeOffer(
  menu: MenuDocument,
  kind: "combos" | "promotions",
  id: string,
): MenuDocument {
  const commerce = menu.commerce ?? emptyCommerce()
  if (!commerce[kind].some((item) => item.id === id))
    throw new Failure("NOT_FOUND", "Oferta não encontrada. Atualize a lista.")
  return {
    ...menu,
    commerce: { ...commerce, [kind]: commerce[kind].filter((item) => item.id !== id) },
  }
}
