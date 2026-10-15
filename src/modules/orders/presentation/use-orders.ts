import { useCallback, useEffect, useRef, useState } from "react"
import type { AppError, OrderView } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
export function useOrders(restaurantId: string) {
  const { orders } = useServices()
  const [pages, setPages] = useState<(string | undefined)[]>([undefined])
  const cursor = pages.at(-1)
  const [data, setData] = useState<{
    items: OrderView[]
    nextCursor: string | null
  } | null>(null)
  const [error, setError] = useState<AppError | null>(null),
    [loading, setLoading] = useState(false)
  const generation = useRef({ value: 0 })
  const reload = useCallback(async () => {
    if (!orders) return
    const request = ++generation.current.value
    setLoading(true)
    const result = await orders.list(restaurantId, cursor)
    if (generation.current.value !== request) return
    if (result.ok) {
      setData(result.value)
      setError(null)
    } else setError(result.error)
    setLoading(false)
  }, [orders, restaurantId, cursor])
  useEffect(() => {
    const sequence = generation.current
    void reload()
    const interval = setInterval(() => void reload(), 15000)
    return () => {
      sequence.value++
      clearInterval(interval)
    }
  }, [reload])
  return {
    data,
    error,
    loading,
    reload,
    page: pages.length,
    next: () => {
      if (data?.nextCursor) {
        setData(null)
        setPages([...pages, data.nextCursor])
      }
    },
    previous: () => {
      if (pages.length > 1) {
        setData(null)
        setPages(pages.slice(0, -1))
      }
    },
  }
}
