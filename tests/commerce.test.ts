import { sampleAddress } from "./address-fixture"
import { describe, it, expect } from "vitest"
import {
  emptyCommerce,
  parseCommerce,
  type Combo,
  type Promotion,
} from "@cardapio/domain/commerce"
import { saveCombo, savePromotion } from "@cardapio/domain/commerce-changes"
import { priceLine, quoteOrder, lineKey } from "@cardapio/domain/quote"
import { validateCheckout } from "@cardapio/domain/checkout"
import { deleteProduct } from "@cardapio/domain/catalog-changes"
import { can, canAdvance } from "@cardapio/domain/permissions"
import { sampleMenu } from "./helpers"
const now = Date.parse("2026-10-15T12:00:00Z")
const menu = sampleMenu(),
  product = menu.products[0]!,
  drink = menu.products[1]!
const combo: Combo = {
  id: "combo-1",
  name: "Dupla da casa",
  description: "",
  imageUrl: "",
  price: 3990,
  active: true,
  items: [{ productId: product.id, quantity: 2 }],
  groups: [
    { id: "drink", name: "Bebida", options: [{ productId: drink.id, extraPrice: 200 }] },
  ],
}
const promotion: Promotion = {
  id: "promo-1",
  name: "Oferta",
  code: "",
  kind: "PERCENT",
  value: 10,
  minSubtotal: 0,
  maxDiscount: 0,
  includeCombos: true,
  active: true,
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-11-01T00:00:00Z",
  maxUses: 0,
  used: 0,
}
const configured = {
  ...saveCombo(menu, combo),
  restaurant: { ...menu.restaurant, isOpen: true, minOrder: 0 },
}
const line = {
  productId: combo.id,
  kind: "COMBO" as const,
  selections: { drink: drink.id },
  quantity: 1,
  unitPrice: 4190,
  note: "",
}
const cart = { restaurantId: menu.restaurant.id, lines: [line] }
const details = {
  name: "Cliente",
  phone: "11999999999",
  address: "Rua A, 1",
  deliveryAddress: sampleAddress(),
  notes: "",
  payment: "Pix" as const,
  cashChange: "",
}
describe("combos, promoções e entrega", () => {
  it("snapshot includes canonical choices and integer surcharges", () => {
    const priced = priceLine(configured, line)
    expect(priced.unitPrice).toBe(4190)
    expect(priced.components).toEqual([`2× ${product.name}`, `Bebida: ${drink.name}`])
    expect(lineKey(line)).not.toBe(
      lineKey({ ...line, selections: { drink: product.id } }),
    )
  })
  it("requires every choice, only registered products and availability", () => {
    for (const selections of [
      {},
      { drink: product.id },
      { drink: drink.id, extra: drink.id },
    ] as Record<string, string>[])
      expect(() => priceLine(configured, { ...line, selections })).toThrow()
    expect(() =>
      priceLine(
        {
          ...configured,
          products: configured.products.map((p) =>
            p.id === drink.id ? { ...p, available: false } : p,
          ),
        },
        line,
      ),
    ).toThrow()
    expect(() =>
      saveCombo(menu, { ...combo, items: [{ productId: "foreign", quantity: 1 }] }),
    ).toThrow()
    expect(() => deleteProduct(configured, product.id)).toThrow(/combo/)
  })
  it("blocks forged prices, duplicate combinations and cross-store carts", () => {
    expect(() =>
      quoteOrder(configured, { ...cart, lines: [{ ...line, unitPrice: 1 }] }),
    ).toThrow()
    expect(() => quoteOrder(configured, { ...cart, lines: [line, line] })).toThrow()
    expect(() => quoteOrder(configured, { ...cart, restaurantId: "other" })).toThrow()
  })
  it("applies one best eligible promotion with rounding and cap", () => {
    const m = savePromotion(savePromotion(configured, promotion), {
      ...promotion,
      id: "fixed",
      kind: "FIXED",
      value: 800,
      maxDiscount: 500,
    })
    const quote = quoteOrder(m, cart, {}, now)
    expect(quote.discount).toBe(500)
    expect(quote.promotionId).toBe("fixed")
    expect(quote.total).toBe(4190 + menu.restaurant.deliveryFee - 500)
  })
  it("percentage discounts truncate fractional cents once on the eligible total and never discount freight", () => {
    const m = savePromotion(
      {
        ...configured,
        products: configured.products.map((p) =>
          p.id === product.id ? { ...p, price: 101 } : p,
        ),
        restaurant: { ...configured.restaurant, deliveryFee: 299 },
      },
      { ...promotion, value: 33 },
    )
    const ordinary = {
      restaurantId: m.restaurant.id,
      lines: [{ productId: product.id, quantity: 3, unitPrice: 101, note: "" }],
    }
    const quote = quoteOrder(m, ordinary, {}, now)
    expect(quote.subtotal).toBe(303)
    expect(quote.discount).toBe(99)
    expect(quote.total).toBe(503)
    expect(quote.total).toBe(quote.subtotal + quote.deliveryFee - quote.discount)
    const hundred = quoteOrder(
      savePromotion(m, { ...promotion, value: 100 }),
      ordinary,
      {},
      now,
    )
    expect(hundred.total).toBe(299)
    const fixed = quoteOrder(
      savePromotion(m, { ...promotion, kind: "FIXED", value: 10000 }),
      ordinary,
      {},
      now,
    )
    expect(fixed.discount).toBe(303)
    expect(fixed.total).toBe(299)
  })
  it("expired, exhausted, inapplicable or unknown coupons fail closed", () => {
    const m = savePromotion(configured, { ...promotion, code: "CLIENTE", maxUses: 1 })
    expect(() =>
      quoteOrder(m, cart, { couponCode: "CLIENTE" }, Date.parse(promotion.endsAt)),
    ).toThrow()
    expect(() => quoteOrder(m, cart, { couponCode: "WRONG" }, now)).toThrow()
    const used = {
      ...m,
      commerce: {
        ...m.commerce!,
        promotions: [{ ...m.commerce!.promotions[0]!, used: 1 }],
      },
    }
    expect(() => quoteOrder(used, cart, { couponCode: "CLIENTE" }, now)).toThrow()
    expect(() =>
      quoteOrder(
        savePromotion(configured, {
          ...promotion,
          code: "CLIENTE",
          includeCombos: false,
        }),
        cart,
        { couponCode: "CLIENTE" },
        now,
      ),
    ).toThrow()
  })
  it("quote revalidates totals when a discount expires", () => {
    const m = savePromotion(configured, promotion),
      quote = quoteOrder(m, cart, {}, now)
    expect(() =>
      quoteOrder(m, cart, { expectedTotal: quote.total }, Date.parse(promotion.endsAt)),
    ).toThrow(/total mudou/)
  })
  it("selects a tenant-owned active region, pickup has zero freight", () => {
    const commerce = {
      ...emptyCommerce(),
      combos: [combo],
      delivery: {
        enabled: true,
        pickupEnabled: true,
        mode: "ZONES" as const,
        pickupEta: "20 min",
        zones: [
          {
            id: "zone",
            state: "SP",
            city: "São Paulo",
            neighborhood: "Centro",
            fee: 900,
            etaMin: 30,
            etaMax: 50,
            active: true,
            latitude: null,
            longitude: null,
          },
        ],
      },
    }
    const m = { ...configured, commerce: parseCommerce(commerce, menu.products) }
    expect(() => quoteOrder(m, cart)).toThrow(/bairro/)
    expect(() =>
      quoteOrder(m, cart, { fulfillment: { mode: "DELIVERY", zoneId: "foreign" } }),
    ).toThrow()
    expect(
      quoteOrder(m, cart, { fulfillment: { mode: "DELIVERY", zoneId: "zone" } })
        .deliveryFee,
    ).toBe(900)
    expect(quoteOrder(m, cart, { fulfillment: { mode: "PICKUP" } }).deliveryFee).toBe(0)
    const validated = validateCheckout(
      m,
      menu.restaurant.id,
      m.revision,
      cart,
      { ...details, address: "" },
      { fulfillment: { mode: "PICKUP" }, requireWhatsapp: false },
    )
    expect(validated.customer.address).toBe("Retirada na loja")
  })
  it("delivery-free coupons and minimum spend are rechecked", () => {
    const m = savePromotion(configured, { ...promotion, kind: "FREE_DELIVERY", value: 0 })
    expect(quoteOrder(m, cart, {}, now).discount).toBe(menu.restaurant.deliveryFee)
    expect(() =>
      validateCheckout(
        { ...m, restaurant: { ...m.restaurant, minOrder: 99999 } },
        menu.restaurant.id,
        m.revision,
        cart,
        details,
        { now },
      ),
    ).toThrow(/mínimo/)
    expect(() =>
      validateCheckout(
        m,
        menu.restaurant.id,
        m.revision,
        cart,
        { ...details, payment: "Dinheiro", cashChange: "1" },
        { now },
      ),
    ).toThrow(/troco/)
  })
  it("normalizes regions and coupons and rejects duplicates", () => {
    const m = savePromotion(configured, { ...promotion, code: "promo" })
    expect(m.commerce!.promotions[0]!.code).toBe("PROMO")
    expect(() =>
      savePromotion(m, { ...promotion, id: "another", code: "PROMO" }),
    ).toThrow()
  })
  it("roles grant only the required operations", () => {
    expect(can("COURIER", "catalog:write")).toBe(false)
    expect(can("KITCHEN", "members:write")).toBe(false)
    expect(canAdvance("KITCHEN", "READY")).toBe(true)
    expect(canAdvance("KITCHEN", "CANCELLED")).toBe(false)
    expect(canAdvance("COURIER", "PREPARING")).toBe(false)
    expect(canAdvance("COURIER", "COMPLETED")).toBe(true)
    expect(canAdvance("VIEWER", "PREPARING")).toBe(false)
  })
})
