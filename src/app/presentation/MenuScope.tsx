import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { MenuDocument } from "../../modules/catalog/application/menu-document"

import type { AppError } from "../../shared/application/result"

import ErrorNotice from "../../shared/presentation/ErrorNotice"
import { applyStoreHours } from "@cardapio/domain/restaurant-changes"

import { useServices } from "./ServicesProvider"

interface MenuContextValue {
  menu: MenuDocument
  error: AppError | null
  loading: boolean
  reload(): Promise<MenuDocument | null>
}

const MenuContext = createContext<MenuContextValue | null>(null)

export default function MenuScope({
  slug,
  restaurantId: adminRestaurantId,
  children,
}: {
  slug: string
  restaurantId?: string
  children: ReactNode
}) {
  const services = useServices()

  const [menu, setMenu] = useState<MenuDocument | null>(null)

  const [error, setError] = useState<AppError | null>(null)

  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now)

  const generation = useRef({ value: 0 })

  const reload = useCallback(async () => {
    const request = ++generation.current.value

    setLoading(true)

    const result = await (adminRestaurantId && services.menu.loadAdmin
      ? services.menu.loadAdmin(adminRestaurantId)
      : services.menu.execute(slug))

    if (request !== generation.current.value) return null

    if (result.ok) {
      setMenu(result.value)
      setError(null)
    } else setError(result.error)

    setLoading(false)

    return result.ok ? result.value : null
  }, [services, slug, adminRestaurantId])

  useEffect(() => {
    const sequence = generation.current
    void reload()
    return () => {
      sequence.value++
    }
  }, [reload])

  const restaurantId = menu?.restaurant.id
  const scheduled = menu?.restaurant.hours?.enabled
  useEffect(() => {
    if (!scheduled) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [scheduled])

  useEffect(
    () =>
      restaurantId
        ? services.menu.subscribe(restaurantId, (saved) => {
            if (saved?.restaurant.id === restaurantId) {
              // Publish the confirmed write before the next form can mount, and
              // invalidate any earlier read still in flight. Open drafts keep
              // their own revision for conflict detection.
              generation.current.value++
              setMenu((current) =>
                current && current.revision > saved.revision ? current : saved,
              )
              setError(null)
              setLoading(false)
            } else void reload()
          })
        : undefined,

    [services, restaurantId, reload],
  )

  if (!menu)
    return (
      <main className="state-page">
        {error ? (
          <ErrorNotice error={error} onRetry={() => void reload()} />
        ) : (
          <p role="status">Carregando cardápio…</p>
        )}
      </main>
    )

  return (
    <MenuContext.Provider
      value={{
        menu: applyStoreHours(menu, Math.max(now, Date.now())),
        error,
        loading,
        reload,
      }}
    >
      {error && (
        <div className="global-error">
          <ErrorNotice error={error} onRetry={() => void reload()} />
        </div>
      )}
      {children}
    </MenuContext.Provider>
  )
}

export function useMenu() {
  const context = useContext(MenuContext)

  if (!context) throw new Error("MenuScope is required")

  return context
}
