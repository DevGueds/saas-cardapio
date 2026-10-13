import { describe, expect, it } from "vitest"

import { parseMoney } from "../src/shared/domain/money"

import { brazilianPhone } from "../src/shared/domain/validation"

import {
  validateCart,
  reconcileCart,
  type Cart,
} from "../src/modules/checkout/domain/cart"

import { sampleMenu } from "./helpers"

describe("valores monetários", () => {
  it.each([
    ["28.90", 2890],
    ["28,90", 2890],
    ["1,2", 120],
    ["0", 0],
    [" 100 ", 10000],
  ])("converte %s para centavos", (value, expected) =>
    expect(parseMoney(value)).toBe(expected),
  )

  it.each([
    "1,23abc",
    "Infinity",
    "NaN",
    "1.234,56",
    "-1",
    "1e3",
    "2.345",
    "",
    "9007199254740992",
    "2,3,4",
  ])("rejeita %s integralmente", (value) => expect(() => parseMoney(value)).toThrow())

  it("exige preço positivo", () => expect(() => parseMoney("0", "price", true)).toThrow())
})

describe("telefone brasileiro", () => {
  it("normaliza DDD 55 sem confundi-lo com DDI", () =>
    expect(brazilianPhone("(55) 99999-8888")).toBe("5555999998888"))

  it("normaliza país explícito", () =>
    expect(brazilianPhone("+55 (11) 99999-8888")).toBe("5511999998888"))

  it.each(["551234", "abc11999998888", "00000000000", "+1 212 555-0000"])(
    "rejeita telefone inválido %s",
    (value) => expect(() => brazilianPhone(value)).toThrow(),
  )
})

describe("carrinho", () => {
  const menu = sampleMenu()

  const cart: Cart = {
    restaurantId: menu.restaurant.id,
    lines: [{ productId: "prod-1", quantity: 2, unitPrice: 2800, note: "" }],
  }

  it("calcula totais exatos em centavos", () =>
    expect(validateCart(cart, "demo-store", menu.products)).toBe(5600))

  it.each([0, -1, 1.5, Infinity, 1000])("bloqueia quantidade %s", (quantity) =>
    expect(() =>
      validateCart(
        { ...cart, lines: [{ ...cart.lines[0], quantity }] },
        "demo-store",
        menu.products,
      ),
    ).toThrow(),
  )

  it("isola restaurantes", () =>
    expect(() => validateCart(cart, "outra-loja", menu.products)).toThrow())

  it("reconcilia explicitamente preços e produtos removidos", () => {
    const next = menu.products
      .filter((product) => product.id !== "prod-9")
      .map((product) => (product.id === "prod-1" ? { ...product, price: 3000 } : product))

    const old = {
      ...cart,
      lines: [
        ...cart.lines,
        { productId: "prod-9", quantity: 1, unitPrice: 600, note: "" },
      ],
    }

    expect(() => validateCart(old, "demo-store", next)).toThrow()

    expect(reconcileCart(old, next).lines).toEqual([
      { ...cart.lines[0], unitPrice: 3000 },
    ])

    expect(old.lines).toHaveLength(2)
  })
})
