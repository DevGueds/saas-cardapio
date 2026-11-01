import { useCallback, useEffect, useState } from "react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { canRefreshConnection } from "../../../shared/browser-connectivity"
import { useResource } from "../../../shared/presentation/use-resource"
export function useOrders(restaurantId: string) {
  const { orders } = useServices()
  const [pages, setPages] = useState<(string | undefined)[]>([undefined])
  const cursor = pages.at(-1)
  const load = useCallback(
    () =>
      orders
        ? orders.list(restaurantId, cursor)
        : Promise.resolve({ ok: true as const, value: null }),
    [orders, restaurantId, cursor],
  )
  const { data, error, loading, reload } = useResource(load)
  useEffect(() => {
    const interval = setInterval(() => {
      if (canRefreshConnection()) void reload({ dedupe: true })
    }, 15000)
    return () => clearInterval(interval)
  }, [reload])
  return {
    data,
    error,
    loading,
    reload,
    page: pages.length,
    next: () => {
      if (data?.nextCursor) {
        setPages([...pages, data.nextCursor])
      }
    },
    previous: () => {
      if (pages.length > 1) {
        setPages(pages.slice(0, -1))
      }
    },
  }
}
