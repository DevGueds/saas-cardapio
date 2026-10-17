import { useDraft } from "../../../shared/presentation/DraftsProvider"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { cartDraftSchema } from "../application/drafts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Cart, CartLine } from "@cardapio/domain/cart"
import type { Combo } from "@cardapio/domain/commerce"
import { lineKey, priceLine } from "@cardapio/domain/quote"
export function useCart(menu: MenuDocument) {
  const { mode } = useServices(),
    restaurantId = menu.restaurant.id
  const draft = useDraft<Cart>(
    `${mode ?? "demo"}:customer:${restaurantId}:cart`,
    { restaurantId, lines: [] },
    (value) => {
      const parsed = cartDraftSchema.parse(value)
      if (parsed.restaurantId !== restaurantId) throw new Error("foreign_cart")
      return parsed
    },
  )
  const cart = draft.value
  const describe = (line: CartLine) => {
    try {
      return { priced: priceLine(menu, line), available: true }
    } catch {
      return { priced: null, available: false }
    }
  }
  const changed = cart.lines.some((line) => {
    const result = describe(line)
    if (result.priced) return result.priced.unitPrice !== line.unitPrice
    return line.kind === "COMBO"
      ? !menu.commerce?.combos.some((c) => c.id === line.productId)
      : !menu.products.some((p) => p.id === line.productId)
  })
  const unavailable =
    !!draft.issue || cart.lines.some((line) => !describe(line).available)
  function updateQuantity(key: string, delta: number) {
    draft.set((current) => {
      const existing = current.lines.find((l) => lineKey(l) === key),
        product = menu.products.find((p) => p.id === key)
      if (delta > 0 && (existing ? !describe(existing).available : !product?.available))
        return current
      const quantity = Math.max(0, Math.min(999, (existing?.quantity ?? 0) + delta))
      if (!quantity)
        return { ...current, lines: current.lines.filter((l) => lineKey(l) !== key) }
      if (!existing && (!product || current.lines.length >= 100)) return current
      const next: CartLine = existing
        ? { ...existing, quantity }
        : { productId: key, quantity, unitPrice: product!.price, note: "" }
      return {
        ...current,
        lines: existing
          ? current.lines.map((l) => (lineKey(l) === key ? next : l))
          : [...current.lines, next],
      }
    })
  }
  function addCombo(combo: Combo, selections: Readonly<Record<string, string>>) {
    const line: CartLine = {
      productId: combo.id,
      kind: "COMBO",
      quantity: 1,
      unitPrice: combo.price,
      note: "",
      selections,
    }
    const pricedLine = { ...line, unitPrice: priceLine(menu, line).unitPrice }
    draft.set((current) => {
      const key = lineKey(line),
        existing = current.lines.find((l) => lineKey(l) === key)
      return {
        ...current,
        lines: existing
          ? current.lines.map((l) =>
              lineKey(l) === key ? { ...l, quantity: Math.min(999, l.quantity + 1) } : l,
            )
          : current.lines.length < 100
            ? [...current.lines, pricedLine]
            : current.lines,
      }
    })
  }
  return {
    cart,
    draft,
    describe,
    addCombo,
    clear: () => draft.set({ restaurantId, lines: [] }),
    changed,
    unavailable,
    updateQuantity,
    setNote: (key: string, note: string) =>
      draft.set((current) => ({
        ...current,
        lines: current.lines.map((l) => (lineKey(l) === key ? { ...l, note } : l)),
      })),
    reconcile: () =>
      draft.set((current) => ({
        ...current,
        lines: current.lines.flatMap((line) => {
          try {
            return [{ ...line, unitPrice: priceLine(menu, line).unitPrice }]
          } catch {
            return []
          }
        }),
      })),
    subtotal: cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    itemCount: cart.lines.reduce((sum, l) => sum + l.quantity, 0),
    quantity: (id: string) =>
      cart.lines
        .filter((l) => l.productId === id)
        .reduce((sum, l) => sum + l.quantity, 0),
  }
}
export type CartController = ReturnType<typeof useCart>
