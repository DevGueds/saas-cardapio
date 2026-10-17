import { Failure, requireValid } from "./failure.js"

import { assertCents } from "./money.js"

import type { Product } from "./catalog.js"

export type CartLine = Readonly<{
  kind?: "PRODUCT" | "COMBO"
  selections?: Readonly<Record<string, string>>
  productId: string
  quantity: number
  unitPrice: number
  note: string
}>

export type Cart = Readonly<{ restaurantId: string; lines: readonly CartLine[] }>

export function validateCart(
  cart: Cart,
  restaurantId: string,
  products: readonly Product[],
): number {
  requireValid(
    cart.restaurantId === restaurantId,
    "O carrinho pertence a outro restaurante.",
  )

  requireValid(cart.lines.length > 0, "Seu carrinho está vazio.")

  requireValid(
    new Set(cart.lines.map((line) => line.productId)).size === cart.lines.length,
    "O carrinho contém itens duplicados.",
  )

  let subtotal = 0

  for (const line of cart.lines) {
    const product = products.find((item) => item.id === line.productId)

    if (!product || product.price !== line.unitPrice)
      throw new Failure(
        "CONFLICT",
        "O catálogo mudou. Atualize os itens do carrinho antes de continuar.",
      )

    requireValid(
      product.restaurantId === restaurantId && product.available,
      `O produto ${product.name} está indisponível. Remova-o para continuar.`,
    )

    requireValid(
      Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999,

      "Informe uma quantidade entre 1 e 999.",
    )

    subtotal += product.price * line.quantity

    assertCents(subtotal, "subtotal")
  }

  return subtotal
}

export function reconcileCart(cart: Cart, products: readonly Product[]): Cart {
  return {
    ...cart,
    lines: cart.lines.flatMap((line) => {
      const product = products.find(
        (item) => item.id === line.productId && item.restaurantId === cart.restaurantId,
      )

      return product ? [{ ...line, unitPrice: product.price }] : []
    }),
  }
}
