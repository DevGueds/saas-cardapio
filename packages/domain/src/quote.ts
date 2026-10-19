import { Failure, requireValid } from "./failure.js"
import { assertCents } from "./money.js"
import type { MenuDocument } from "./menu-document.js"
import type { Cart, CartLine } from "./cart.js"
import { emptyCommerce, type Combo, type Promotion } from "./commerce.js"
import { priceAddons } from "./menu-options.js"
export interface Fulfillment {
  mode: "DELIVERY" | "PICKUP"
  zoneId?: string
}
export interface CheckoutOptions {
  whatsappConsent?: boolean
  fulfillment?: Fulfillment
  couponCode?: string
  expectedTotal?: number
}
export interface PricedLine {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  note: string
  kind?: "PRODUCT" | "COMBO"
  components?: string[]
}
export interface Quote {
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  promotionId: string | null
  promotionName: string | null
  eta: string
  region: string
  fulfillment: Fulfillment
  items: PricedLine[]
}
export function lineKey(
  line: Pick<CartLine, "productId" | "kind" | "selections" | "addons">,
) {
  return line.kind === "COMBO"
    ? `${line.productId}:${Object.entries(line.selections ?? {})
        .sort()
        .map(([g, p]) => `${g}=${p}`)
        .join(",")}`
    : Object.keys(line.addons ?? {}).length
      ? `${line.productId}:addons:${Object.entries(line.addons!)
          .sort()
          .map(([id, qty]) => `${id}=${qty}`)
          .join(",")}`
      : line.productId
}
export function comboAvailable(combo: Combo, menu: Pick<MenuDocument, "products">) {
  const available = (id: string) => menu.products.some((p) => p.id === id && p.available)
  return (
    combo.active &&
    combo.items.every((i) => available(i.productId)) &&
    combo.groups.every((g) => g.options.some((o) => available(o.productId)))
  )
}
export function priceLine(menu: MenuDocument, line: CartLine): PricedLine {
  requireValid(
    line.kind === undefined || line.kind === "PRODUCT" || line.kind === "COMBO",
    "Tipo de item inválido.",
  )
  requireValid(
    Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999,
    "Quantidade inválida.",
  )
  if (line.kind !== "COMBO") {
    requireValid(
      !line.selections || Object.keys(line.selections).length === 0,
      "Escolhas só são permitidas em combos.",
    )
    const product = menu.products.find((p) => p.id === line.productId)
    if (!product)
      throw new Failure("CONFLICT", "Um produto foi removido. Atualize seu carrinho.")
    requireValid(product.available, `O produto ${product.name} está indisponível.`)
    const { extra, components } = priceAddons(
      menu.commerce?.addonGroups ?? [],
      product.id,
      line.addons,
    )
    assertCents(product.price + extra, "price", true)
    return {
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPrice: product.price + extra,
      note: line.note,
      ...(components.length ? { components } : {}),
    }
  }
  requireValid(
    !Object.keys(line.addons ?? {}).length,
    "Adicionais avulsos não são aceitos em combos.",
  )
  const combo = menu.commerce?.combos.find((c) => c.id === line.productId)
  if (!combo)
    throw new Failure("CONFLICT", "Um combo foi removido. Atualize seu carrinho.")
  requireValid(comboAvailable(combo, menu), `O combo ${combo.name} está indisponível.`)
  const selections = line.selections ?? {}
  requireValid(
    Object.keys(selections).length === combo.groups.length,
    "Complete todas as escolhas do combo.",
    "selections",
  )
  let unitPrice = combo.price
  const components = combo.items.map(
    (i) => `${i.quantity}× ${menu.products.find((p) => p.id === i.productId)!.name}`,
  )
  for (const group of combo.groups) {
    const option = group.options.find((o) => o.productId === selections[group.id])
    requireValid(!!option, `Escolha uma opção em ${group.name}.`, "selections")
    const product = menu.products.find((p) => p.id === option!.productId)
    requireValid(!!product?.available, `A escolha de ${group.name} está indisponível.`)
    unitPrice += option!.extraPrice
    components.push(`${group.name}: ${product!.name}`)
  }
  assertCents(unitPrice, "price", true)
  return {
    productId: combo.id,
    name: combo.name,
    quantity: line.quantity,
    unitPrice,
    note: line.note,
    kind: "COMBO",
    components,
  }
}
export function promotionActive(p: Promotion, now: number) {
  return (
    p.active &&
    Date.parse(p.startsAt) <= now &&
    now < Date.parse(p.endsAt) &&
    (!p.maxUses || p.used < p.maxUses)
  )
}
export function quoteOrder(
  menu: MenuDocument,
  cart: Cart,
  options: CheckoutOptions = {},
  now = Date.now(),
): Quote {
  requireValid(
    cart.restaurantId === menu.restaurant.id &&
      cart.lines.length > 0 &&
      cart.lines.length <= 100,
    "Carrinho vazio ou de outra loja.",
  )
  requireValid(
    new Set(cart.lines.map(lineKey)).size === cart.lines.length,
    "Itens duplicados no carrinho.",
  )
  const items = cart.lines.map((line) => {
    const priced = priceLine(menu, line)
    if (priced.unitPrice !== line.unitPrice)
      throw new Failure("CONFLICT", "Os preços mudaram. Atualize os itens do carrinho.")
    return priced
  })
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  assertCents(subtotal, "subtotal", true)
  const commerce = menu.commerce ?? emptyCommerce(),
    fulfillment = options.fulfillment ?? { mode: "DELIVERY" }
  let deliveryFee = 0,
    eta = commerce.delivery.pickupEta,
    region = "Retirada na loja"
  if (fulfillment.mode === "PICKUP")
    requireValid(
      commerce.delivery.pickupEnabled && !fulfillment.zoneId,
      "A retirada não está disponível nesta loja.",
    )
  else {
    requireValid(
      fulfillment.mode === "DELIVERY" && commerce.delivery.enabled,
      "A entrega não está disponível nesta loja.",
    )
    if (commerce.delivery.mode === "ZONES") {
      const zone = commerce.delivery.zones.find(
        (z) => z.id === fulfillment.zoneId && z.active,
      )
      requireValid(!!zone, "Selecione um bairro atendido pela loja.", "zoneId")
      deliveryFee = zone!.fee
      eta = `${zone!.etaMin}–${zone!.etaMax} min`
      region = `${zone!.neighborhood}, ${zone!.city} / ${zone!.state}`
    } else {
      requireValid(!fulfillment.zoneId, "Atualize a região de entrega.")
      deliveryFee = menu.restaurant.deliveryFee
      eta = menu.restaurant.eta
      region = "Entrega local"
    }
  }
  const coupon = (options.couponCode ?? "").trim().toUpperCase()
  const candidates = commerce.promotions.filter(
    (p) =>
      promotionActive(p, now) &&
      subtotal >= p.minSubtotal &&
      (coupon ? p.code === coupon : !p.code),
  )
  if (coupon)
    requireValid(
      candidates.length > 0,
      "Cupom inválido, esgotado, fora da validade ou pedido abaixo do mínimo.",
      "couponCode",
    )
  const saving = (p: Promotion) => {
    if (p.kind === "FREE_DELIVERY")
      return fulfillment.mode === "DELIVERY" ? deliveryFee : 0
    const eligible = items
      .filter((i) => p.includeCombos || i.kind !== "COMBO")
      .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    const discount =
      p.kind === "PERCENT" ? Math.floor((eligible * p.value) / 100) : p.value
    return Math.min(discount, eligible, p.maxDiscount || eligible)
  }
  const best = candidates
    .map((p) => ({ p, discount: saving(p) }))
    .sort((a, b) => b.discount - a.discount || a.p.id.localeCompare(b.p.id))[0]
  if (coupon)
    requireValid(
      !!best && best.discount > 0,
      "Este cupom não se aplica aos itens ou à modalidade escolhida.",
      "couponCode",
    )
  const discount = best?.discount ?? 0,
    total = subtotal + deliveryFee - discount
  assertCents(total, "total")
  if (options.expectedTotal !== undefined && options.expectedTotal !== total)
    throw new Failure(
      "CONFLICT",
      "O total mudou. Confira o resumo atualizado antes de enviar.",
    )
  return {
    subtotal,
    deliveryFee,
    discount,
    total,
    eta,
    region,
    fulfillment,
    items,
    promotionId: discount ? best!.p.id : null,
    promotionName: discount ? best!.p.name : null,
  }
}
