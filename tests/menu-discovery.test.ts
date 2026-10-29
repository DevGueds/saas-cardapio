import { expect, it } from "vitest"
import { discoverProducts } from "../src/modules/catalog/application/menu-discovery"
import { sampleMenu } from "./helpers"
import { emptyCommerce } from "@cardapio/domain/commerce"
it("best sellers uses the actual ranking rather than manual featured flags", () => {
  const menu = sampleMenu(),
    rank = menu.products
      .filter((p) => p.available)
      .slice(0, 2)
      .reverse()
      .map((p) => p.id)
  expect(
    discoverProducts(menu, "$all", "", "BEST_SELLERS", rank, Date.now()).map((p) => p.id),
  ).toEqual(rank)
  expect(discoverProducts(menu, "$all", "", "BEST_SELLERS", [], Date.now())).toEqual([])
})
it("cheapest ordering is numerical, keeps category selection and combines with search", () => {
  const menu = sampleMenu(),
    result = discoverProducts(menu, "$all", "", "CHEAPEST", [], Date.now())
  expect(result.map((p) => p.price)).toEqual(
    [...result.map((p) => p.price)].sort((a, b) => a - b),
  )
  const category = menu.categories[0]!
  expect(
    discoverProducts(menu, category.id, "", "CHEAPEST", [], Date.now()).every(
      (p) => p.categoryId === category.id,
    ),
  ).toBe(true)
  expect(
    discoverProducts(
      menu,
      "$all",
      menu.products[0]!.name,
      "CHEAPEST",
      [],
      Date.now(),
    ).some((p) => p.id === menu.products[0]!.id),
  ).toBe(true)
})
it("promotion filtering respects start, end and usage limits without inventing discounted unit prices", () => {
  const now = Date.now(),
    menu = sampleMenu(),
    commerce = emptyCommerce()
  commerce.promotions = [
    {
      id: "offer",
      name: "Oferta",
      code: "",
      kind: "PERCENT",
      value: 10,
      minSubtotal: 0,
      maxDiscount: 0,
      includeCombos: false,
      active: true,
      startsAt: new Date(now - 1000).toISOString(),
      endsAt: new Date(now + 1000).toISOString(),
      maxUses: 1,
      used: 0,
    },
  ]
  const source = { ...menu, commerce }
  const result = discoverProducts(source, "$all", "", "PROMOTIONS", [], now)
  expect(result.length).toBeGreaterThan(0)
  expect(
    result.every(
      (p) => p.price === menu.products.find((original) => original.id === p.id)?.price,
    ),
  ).toBe(true)
  expect(discoverProducts(source, "$all", "", "PROMOTIONS", [], now + 1000)).toEqual([])
  commerce.promotions[0]!.used = 1
  expect(discoverProducts(source, "$all", "", "PROMOTIONS", [], now)).toEqual([])
})
