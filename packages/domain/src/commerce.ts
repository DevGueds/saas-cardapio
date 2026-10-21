import { requireValid } from "./failure.js"
import { assertCents } from "./money.js"
import { parseRadiusDelivery, type RadiusDelivery } from "./delivery-radius.js"
import {
  boolean,
  identifier,
  imageReference,
  normalizeName,
  record,
  text,
} from "./validation.js"
import type { Product } from "./catalog.js"
import {
  parseAddonGroups,
  parseAppearance,
  defaultAppearance,
  type AddonGroup,
  type MenuAppearance,
} from "./menu-options.js"

export interface ComboItem {
  productId: string
  quantity: number
}
export interface ComboOption {
  productId: string
  extraPrice: number
}
export interface ComboGroup {
  id: string
  name: string
  options: ComboOption[]
}
export interface Combo {
  id: string
  name: string
  description: string
  imageUrl: string
  price: number
  active: boolean
  items: ComboItem[]
  groups: ComboGroup[]
}
export interface Promotion {
  id: string
  name: string
  code: string
  kind: "PERCENT" | "FIXED" | "FREE_DELIVERY"
  value: number
  minSubtotal: number
  maxDiscount: number
  includeCombos: boolean
  active: boolean
  startsAt: string
  endsAt: string
  maxUses: number
  used: number
}
export interface DeliveryZone {
  id: string
  state: string
  city: string
  neighborhood: string
  fee: number
  etaMin: number
  etaMax: number
  active: boolean
  latitude: number | null
  longitude: number | null
}
export interface DeliverySettings {
  enabled: boolean
  pickupEnabled: boolean
  mode: "FLAT" | "ZONES" | "RADIUS"
  pickupEta: string
  zones: DeliveryZone[]
  radius?: RadiusDelivery
}
export interface Commerce {
  addonGroups?: AddonGroup[]
  appearance?: MenuAppearance
  combos: Combo[]
  promotions: Promotion[]
  delivery: DeliverySettings
}
export const emptyCommerce = (): Commerce => ({
  addonGroups: [],
  appearance: defaultAppearance(),
  combos: [],
  promotions: [],
  delivery: {
    enabled: true,
    pickupEnabled: false,
    mode: "FLAT",
    pickupEta: "30–45 min",
    zones: [],
  },
})
export function integer(value: unknown, min: number, max: number, field: string): number {
  requireValid(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    `Informe um número inteiro entre ${min} e ${max}.`,
    field,
  )
  return value as number
}
function list(value: unknown, maximum: number): unknown[] {
  requireValid(
    Array.isArray(value) && value.length <= maximum,
    "Lista inválida ou acima do limite.",
  )
  return value as unknown[]
}
function distinct(values: string[], message: string) {
  requireValid(new Set(values).size === values.length, message)
}
function cents(value: unknown, field: string, positive = false) {
  assertCents(value, field, positive)
  return value as number
}
export function parseCombo(input: unknown, products: readonly Product[]): Combo {
  const row = record(input)
  const exists = (id: string) =>
    requireValid(
      products.some((p) => p.id === id),
      "Um produto do combo não existe nesta loja.",
      "items",
    )
  const items = list(row.items, 20).map((input) => {
    const item = record(input),
      productId = identifier(item.productId)
    exists(productId)
    return { productId, quantity: integer(item.quantity, 1, 20, "quantity") }
  })
  const groups = list(row.groups, 8).map((input) => {
    const group = record(input)
    const options = list(group.options, 20).map((input) => {
      const option = record(input),
        productId = identifier(option.productId)
      exists(productId)
      return { productId, extraPrice: cents(option.extraPrice, "extraPrice") }
    })
    requireValid(
      options.length > 0,
      "Cada escolha precisa de pelo menos uma opção.",
      "groups",
    )
    distinct(
      options.map((o) => o.productId),
      "Opção duplicada no combo.",
    )
    return { id: identifier(group.id), name: text(group.name, "name", 80, true), options }
  })
  requireValid(
    items.length + groups.length > 0,
    "Inclua produtos ou escolhas no combo.",
    "items",
  )
  distinct(
    items.map((i) => i.productId),
    "Produto fixo duplicado no combo.",
  )
  distinct(
    groups.map((g) => g.id),
    "Grupo de escolhas duplicado.",
  )
  return {
    id: identifier(row.id),
    name: text(row.name, "name", 120, true),
    description: text(row.description, "description", 2000),
    imageUrl: imageReference(row.imageUrl),
    price: cents(row.price, "price", true),
    active: boolean(row.active, "active"),
    items,
    groups,
  }
}
export function parsePromotion(input: unknown): Promotion {
  const row = record(input)
  requireValid(
    ["PERCENT", "FIXED", "FREE_DELIVERY"].includes(String(row.kind)),
    "Tipo de promoção inválido.",
  )
  const kind = row.kind as Promotion["kind"],
    code = text(row.code, "code", 30).toUpperCase()
  requireValid(
    !code || /^[A-Z0-9_-]{3,30}$/.test(code),
    "Use de 3 a 30 letras, números, - ou _ no cupom.",
    "code",
  )
  const startsAt = text(row.startsAt, "startsAt", 30, true),
    endsAt = text(row.endsAt, "endsAt", 30, true)
  requireValid(
    Number.isFinite(Date.parse(startsAt)) &&
      Number.isFinite(Date.parse(endsAt)) &&
      Date.parse(endsAt) > Date.parse(startsAt),
    "Defina início e fim válidos para a promoção.",
    "endsAt",
  )
  const value =
    kind === "FREE_DELIVERY"
      ? integer(row.value, 0, 0, "value")
      : kind === "PERCENT"
        ? integer(row.value, 1, 100, "value")
        : cents(row.value, "value", true)
  const maxUses = integer(row.maxUses, 0, 1_000_000, "maxUses"),
    used = integer(row.used, 0, 2_147_483_646, "used")
  requireValid(
    maxUses === 0 || maxUses >= used,
    "O limite não pode ser menor que os usos já realizados.",
    "maxUses",
  )
  return {
    id: identifier(row.id),
    name: text(row.name, "name", 120, true),
    code,
    kind,
    value,
    startsAt,
    endsAt,
    maxUses,
    used,
    active: boolean(row.active, "active"),
    includeCombos: boolean(row.includeCombos, "includeCombos"),
    minSubtotal: cents(row.minSubtotal, "minSubtotal"),
    maxDiscount: cents(row.maxDiscount, "maxDiscount"),
  }
}
export function parseDelivery(input: unknown): DeliverySettings {
  const row = record(input)
  requireValid(
    row.mode === "FLAT" || row.mode === "ZONES" || row.mode === "RADIUS",
    "Modalidade de frete inválida.",
  )
  const zones = list(row.zones, 500).map((input) => {
    const zone = record(input)
    const state = text(zone.state, "state", 2, true).toUpperCase()
    requireValid(
      [
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ].includes(state),
      "Selecione um estado válido.",
      "state",
    )
    const etaMin = integer(zone.etaMin, 1, 1440, "etaMin"),
      etaMax = integer(zone.etaMax, etaMin, 1440, "etaMax")
    const coordinate = (value: unknown, limit: number): number | null => {
      if (value === null) return null
      requireValid(
        typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit,
        "Coordenada inválida.",
      )
      return value as number
    }
    const latitude = coordinate(zone.latitude, 90),
      longitude = coordinate(zone.longitude, 180)
    requireValid(
      (latitude === null) === (longitude === null),
      "Informe as duas coordenadas.",
    )
    return {
      id: identifier(zone.id),
      state,
      city: text(zone.city, "city", 120, true),
      neighborhood: text(zone.neighborhood, "neighborhood", 120, true),
      fee: cents(zone.fee, "fee"),
      etaMin,
      etaMax,
      active: boolean(zone.active, "active"),
      latitude,
      longitude,
    }
  })
  distinct(
    zones.map((z) => z.id),
    "Região duplicada.",
  )
  distinct(
    zones.map((z) => normalizeName(`${z.state}|${z.city}|${z.neighborhood}`)),
    "Este bairro já foi cadastrado nesta cidade.",
  )
  const radius = row.radius === undefined ? undefined : parseRadiusDelivery(row.radius)
  requireValid(
    row.mode !== "RADIUS" || (!!radius?.origin && radius.bands.length > 0),
    "Marque o local da loja e cadastre pelo menos uma faixa de entrega.",
    "radius",
  )
  return {
    enabled: boolean(row.enabled, "enabled"),
    pickupEnabled: boolean(row.pickupEnabled, "pickupEnabled"),
    mode: row.mode,
    pickupEta: text(row.pickupEta, "pickupEta", 80, true),
    zones,
    ...(radius ? { radius } : {}),
  }
}
export function parseCommerce(input: unknown, products: readonly Product[]): Commerce {
  const row = record(input),
    combos = list(row.combos, 100).map((c) => parseCombo(c, products)),
    promotions = list(row.promotions, 100).map(parsePromotion)
  distinct(
    combos.map((c) => c.id),
    "Combo duplicado.",
  )
  distinct(
    promotions.map((p) => p.id),
    "Promoção duplicada.",
  )
  distinct(
    promotions.filter((p) => p.code).map((p) => p.code),
    "Este cupom já existe.",
  )
  requireValid(
    combos.every((c) => !products.some((p) => p.id === c.id)),
    "Identificador de combo em conflito com produto.",
  )
  return {
    combos,
    promotions,
    delivery: parseDelivery(row.delivery),
    addonGroups: parseAddonGroups(row.addonGroups, products),
    appearance: parseAppearance(row.appearance),
  }
}
