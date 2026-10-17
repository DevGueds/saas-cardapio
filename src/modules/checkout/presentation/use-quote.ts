import { useEffect, useState } from "react"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Cart } from "@cardapio/domain/cart"
import { quoteOrder, type CheckoutOptions, type Quote } from "@cardapio/domain/quote"
import type { Result } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { browserExecutor } from "../../../shared/browser-executor"
export function useQuote(menu: MenuDocument, cart: Cart, options: CheckoutOptions) {
  const { quote } = useServices(),
    signature = JSON.stringify({ revision: menu.revision, cart, options })
  const [state, setState] = useState<{ signature: string; result: Result<Quote> } | null>(
    null,
  )
  useEffect(() => {
    if (!cart.lines.length) return
    let active = true,
      generation = 0
    const refresh = async () => {
      const version = ++generation
      const result = quote
        ? await quote(menu.restaurant.slug, menu.revision, cart, options)
        : await browserExecutor.run("checkout", "quote", async () =>
            quoteOrder(menu, cart, options),
          )
      if (active && version === generation) setState({ signature, result })
    }
    const timer = setTimeout(() => void refresh(), 150),
      interval = setInterval(() => {
        if (!document.hidden) void refresh()
      }, 30000)
    return () => {
      active = false
      clearTimeout(timer)
      clearInterval(interval)
    }
    // The signature represents every request input; menu includes the matching revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, quote])
  const current = state?.signature === signature ? state.result : null
  return {
    loading: !current,
    quote: current?.ok ? current.value : null,
    error: current && !current.ok ? current.error : null,
  }
}
