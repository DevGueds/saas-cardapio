import { expect, it } from "vitest"
import { reorderCategories, saveCategory } from "@cardapio/domain/catalog-changes"
import { sampleMenu } from "./helpers"
import { projectedCategoryIndex } from "../src/modules/catalog/application/category-position"

it("projects every visible position in both drag directions without rebuilding a list", () => {
  expect([0, 1, 2, 3, 4].map((index) => projectedCategoryIndex(index, 1, 3))).toEqual([
    0, 3, 1, 2, 4,
  ])
  expect([0, 1, 2, 3, 4].map((index) => projectedCategoryIndex(index, 3, 1))).toEqual([
    0, 2, 3, 1, 4,
  ])
  expect(projectedCategoryIndex(3, -1, -1)).toBe(3)
})

it("persists a complete category permutation without changing products, prices or original data", () => {
  const menu = sampleMenu(),
    ids = menu.categories.map((category) => category.id).reverse()
  const reordered = reorderCategories(menu, ids)
  expect(reordered.categories.map((category) => category.id)).toEqual(ids)
  expect(reordered.products).toBe(menu.products)
  expect(menu.categories.map((category) => category.id)).toEqual([...ids].reverse())
  const created = saveCategory(reordered, "Nova categoria", "new-category")
  expect(created.categories.slice(0, -1)).toEqual(reordered.categories)
  const renamed = saveCategory(reordered, "Nome atualizado", ids[0]!)
  expect(renamed.categories.map((category) => category.id)).toEqual(ids)
})
it("rejects missing, duplicated or foreign categories instead of silently dropping them", () => {
  const menu = sampleMenu(),
    ids = menu.categories.map((category) => category.id)
  for (const candidate of [ids.slice(1), [...ids, ids[0]!], ["foreign", ...ids.slice(1)]])
    expect(() => reorderCategories(menu, candidate)).toThrow()
})
