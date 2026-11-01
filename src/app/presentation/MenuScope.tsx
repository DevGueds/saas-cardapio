import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { MenuDocument } from "../../modules/catalog/application/menu-document"

import type { AppError } from "../../shared/application/result"

import ErrorNotice from "../../shared/presentation/ErrorNotice"
import { effectiveStoreOpen } from "@cardapio/domain/store-hours"
import { subscribeConnectionRecovery } from "../../shared/browser-connectivity"

import { useServices } from "./ServicesProvider"

interface MenuContextValue {
  menu: MenuDocument
  error: AppError | null
  loading: boolean
  refreshing: boolean
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
  const load = useCallback(
    () =>
      adminRestaurantId && services.menu.loadAdmin
        ? services.menu.loadAdmin(adminRestaurantId)
        : services.menu.execute(slug),
    [services, slug, adminRestaurantId],
  )
  const active = useRef<typeof load | null>(null)
  const pending = useRef<{
    source: typeof load
    request: number
    promise: Promise<MenuDocument | null>
  } | null>(null)
  useLayoutEffect(() => {
    const sequence = generation.current
    active.current = load
    return () => {
      sequence.value++
      active.current = null
    }
  }, [load])

  const reload = useCallback((): Promise<MenuDocument | null> => {
    if (active.current !== load) return Promise.resolve(null)
    if (
      pending.current?.source === load &&
      pending.current.request === generation.current.value
    )
      return pending.current.promise
    const request = ++generation.current.value
    setLoading(true)
    const promise = (async () => {
      const result = await load()
      if (request !== generation.current.value || active.current !== load) return null
      if (result.ok) {
        setMenu(result.value)
        setError(null)
      } else setError(result.error)
      setLoading(false)
      return result.ok ? result.value : null
    })().finally(() => {
      if (pending.current?.request === request) pending.current = null
    })
    pending.current = { source: load, request, promise }
    return promise
  }, [load])

  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => subscribeConnectionRecovery(() => void reload()), [reload])

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

  const isOpen = menu ? effectiveStoreOpen(menu.restaurant, now) : false
  const effectiveMenu = useMemo(
    () =>
      menu &&
      (menu.restaurant.isOpen === isOpen
        ? menu
        : { ...menu, restaurant: { ...menu.restaurant, isOpen } }),
    [menu, isOpen],
  )
  const context = useMemo(
    () =>
      effectiveMenu && {
        menu: effectiveMenu,
        error,
        loading: false,
        refreshing: loading,
        reload,
      },
    [effectiveMenu, error, loading, reload],
  )

  if (!menu || !context)
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
    <MenuContext.Provider value={context}>
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
