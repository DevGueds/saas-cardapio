import { describe, it, expect } from "vitest"
import { saveAddon, saveAppearance } from "@cardapio/domain/commerce-changes"
import { parseCommerce } from "@cardapio/domain/commerce"
import { priceLine, lineKey, quoteOrder } from "@cardapio/domain/quote"
import { deleteProduct } from "@cardapio/domain/catalog-changes"
import { sampleMenu } from "./helpers"
const original = sampleMenu(),
  product = original.products[0]!
const group = {
  id: "extras",
  name: "Extras",
  min: 1,
  max: 3,
  active: true,
  productIds: [product.id],
  options: [
    { id: "cheese", name: "Queijo", price: 10, maxQuantity: 2, available: true },
    { id: "bacon", name: "Bacon", price: 20, maxQuantity: 1, available: true },
  ],
}
const menu = saveAddon(original, group)
const line = {
  productId: product.id,
  quantity: 2,
  unitPrice: product.price + 30,
  note: "",
  addons: { cheese: 1, bacon: 1 },
}
describe("product extras", () => {
  it("calculates exact integer prices and preserves named selections in order snapshots", () => {
    const priced = priceLine(menu, line)
    expect(priced.unitPrice).toBe(product.price + 30)
    expect(priced.components).toEqual(["Extras: 1× Queijo", "Extras: 1× Bacon"])
    expect(
      quoteOrder(menu, { restaurantId: menu.restaurant.id, lines: [line] }).subtotal,
    ).toBe((product.price + 30) * 2)
    expect(priced.unitPrice).toBe(
      priceLine(menu, { ...line, addons: { bacon: 1, cheese: 1 } }).unitPrice,
    )
    expect(lineKey(line)).toBe(lineKey({ ...line, addons: { bacon: 1, cheese: 1 } }))
    expect(lineKey(line)).not.toBe(lineKey({ ...line, addons: { cheese: 2 } }))
  })
  it("rejects missing choices, foreign options, fractional/negative/excess quantities and stale prices", () => {
    for (const addons of [
      {},
      { unknown: 1 },
      { cheese: 0 },
      { cheese: 0.5 },
      { cheese: -1 },
      { cheese: 3 },
      { cheese: 2, bacon: 2 },
    ] as Record<string, number>[])
      expect(() => priceLine(menu, { ...line, addons })).toThrow()
    expect(() =>
      quoteOrder(menu, {
        restaurantId: menu.restaurant.id,
        lines: [{ ...line, unitPrice: product.price }],
      }),
    ).toThrow(/preços/)
    expect(() => deleteProduct(menu, product.id)).toThrow(/adicionais/)
  })
  it("revalidates availability and group ownership; old documents retain defaults", () => {
    const paused = saveAddon(menu, {
      ...group,
      options: group.options.map((o) => ({ ...o, available: o.id !== "bacon" })),
    })
    expect(() => priceLine(paused, line)).toThrow(/indisponível/)
    expect(() => saveAddon(menu, { ...group, productIds: ["foreign"] })).toThrow()
    expect(() => saveAddon(menu, { ...group, id: "another" })).toThrow(/repetido/)
    expect(() => saveAddon(menu, { ...group, min: 4 })).toThrow()
    expect(
      parseCommerce(
        { combos: [], promotions: [], delivery: menu.commerce!.delivery },
        menu.products,
      ).appearance?.preset,
    ).toBe("CLASSIC")
  })
  it("only accepts prevalidated appearance settings", () => {
    expect(
      saveAppearance(menu, {
        preset: "COMPACT",
        color: "BLUE",
        showImages: false,
        headline: "Feito na hora",
      }).commerce?.appearance?.preset,
    ).toBe("COMPACT")
    expect(() =>
      saveAppearance(menu, {
        preset: "COMPACT",
        color: "url(javascript:evil)" as "BLUE",
        showImages: true,
        headline: "",
      }),
    ).toThrow()
  })
})
