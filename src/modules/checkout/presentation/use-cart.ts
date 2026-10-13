import { useState } from "react"

import type { Product } from "../../catalog/domain/catalog"

import { reconcileCart, type Cart } from "../domain/cart"

export function useCart(restaurantId: string, products: readonly Product[]) {
  const [cart, setCart] = useState<Cart>({ restaurantId, lines: [] })

  const changed = cart.lines.some((line) => {
    const product = products.find((item) => item.id === line.productId)

    return !product || product.price !== line.unitPrice
  })

  const unavailable = cart.lines.some(
    (line) => !products.find((product) => product.id === line.productId)?.available,
  )

  function updateQuantity(productId: string, delta: number) {
    const product = products.find(
      (item) => item.id === productId && item.restaurantId === restaurantId,
    )

    if (delta > 0 && (!product || !product.available)) return

    setCart((current) => {
      if (current.restaurantId !== restaurantId) return { restaurantId, lines: [] }

      const existing = current.lines.find((line) => line.productId === productId)

      const quantity = Math.max(0, Math.min(999, (existing?.quantity ?? 0) + delta))

      const rest = current.lines.filter((line) => line.productId !== productId)

      if (!quantity) return { ...current, lines: rest }

      if (!existing && !product) return current

      const next = {
        productId,
        quantity,
        unitPrice: existing?.unitPrice ?? product!.price,
        note: existing?.note ?? "",
      }

      return {
        ...current,
        lines: existing
          ? current.lines.map((line) => (line.productId === productId ? next : line))
          : [...rest, next],
      }
    })
  }

  function setNote(productId: string, note: string) {
    setCart((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.productId === productId ? { ...line, note } : line,
      ),
    }))
  }

  return {
    cart,
    changed,
    unavailable,
    updateQuantity,
    setNote,

    reconcile: () => setCart((current) => reconcileCart(current, products)),

    subtotal: cart.lines.reduce(
      (total, line) => total + line.unitPrice * line.quantity,
      0,
    ),

    itemCount: cart.lines.reduce((total, line) => total + line.quantity, 0),

    quantity: (id: string) =>
      cart.lines.find((line) => line.productId === id)?.quantity ?? 0,
  }
}

export type CartController = ReturnType<typeof useCart>
