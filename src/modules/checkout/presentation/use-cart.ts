import { useDraft } from "../../../shared/presentation/DraftsProvider"
import { useCallback, useMemo } from "react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { cartDraftSchema } from "../application/drafts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Cart, CartLine } from "@cardapio/domain/cart"
import type { Combo } from "@cardapio/domain/commerce"
import type { Product } from "@cardapio/domain/catalog"
import { lineKey, priceLine } from "@cardapio/domain/quote"
export function useCart(menu: MenuDocument) {
  const { mode } = useServices(),
    restaurantId = menu.restaurant.id
  const parseCart = useCallback(
    (value: unknown) => {
      const parsed = cartDraftSchema.parse(value)
      if (parsed.restaurantId !== restaurantId) throw new Error("foreign_cart")
      return parsed
    },
    [restaurantId],
  )
  const draft = useDraft<Cart>(
    `${mode ?? "demo"}:customer:${restaurantId}:cart`,
    { restaurantId, lines: [] },
    parseCart,
  )
  const cart = draft.value
  const describe = useCallback(
    (line: CartLine) => {
      try {
        return { priced: priceLine(menu, line), available: true }
      } catch {
        return { priced: null, available: false }
      }
    },
    [menu],
  )
  const analysis = useMemo(() => {
    let changed = false,
      unavailable = false,
      subtotal = 0,
      itemCount = 0
    const quantities = new Map<string, number>()
    for (const line of cart.lines) {
      const result = describe(line)
      changed ||= result.priced
        ? result.priced.unitPrice !== line.unitPrice
        : line.kind === "COMBO"
          ? !menu.commerce?.combos.some((c) => c.id === line.productId)
          : !menu.products.some((p) => p.id === line.productId)
      unavailable ||= !result.available
      subtotal += line.unitPrice * line.quantity
      itemCount += line.quantity
      quantities.set(
        line.productId,
        (quantities.get(line.productId) ?? 0) + line.quantity,
      )
    }
    return { changed, unavailable, subtotal, itemCount, quantities }
  }, [cart.lines, describe, menu])
  const setDraft = draft.set
  const updateQuantity = useCallback(
    (key: string, delta: number) => {
      setDraft((current) => {
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
    },
    [setDraft, menu.products, describe],
  )
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
  function addProduct(
    product: Product,
    addons: Readonly<Record<string, number>>,
    quantity = 1,
  ) {
    const line: CartLine = {
      productId: product.id,
      quantity,
      unitPrice: product.price,
      note: "",
      addons,
    }
    const priced = { ...line, unitPrice: priceLine(menu, line).unitPrice }
    draft.set((current) => {
      const key = lineKey(priced),
        existing = current.lines.some((l) => lineKey(l) === key)
      return {
        ...current,
        lines: existing
          ? current.lines.map((l) =>
              lineKey(l) === key
                ? { ...l, quantity: Math.min(999, l.quantity + quantity) }
                : l,
            )
          : current.lines.length < 100
            ? [...current.lines, priced]
            : current.lines,
      }
    })
  }
  return {
    cart,
    draft,
    describe,
    addCombo,
    addProduct,
    clear: () => draft.set({ restaurantId, lines: [] }),
    changed: analysis.changed,
    unavailable: !!draft.issue || analysis.unavailable,
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
    subtotal: analysis.subtotal,
    itemCount: analysis.itemCount,
    quantity: (id: string) => analysis.quantities.get(id) ?? 0,
  }
}
export type CartController = ReturnType<typeof useCart>
