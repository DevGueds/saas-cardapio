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
  children,
}: {
  slug: string
  children: ReactNode
}) {
  const services = useServices()

  const [menu, setMenu] = useState<MenuDocument | null>(null)

  const [error, setError] = useState<AppError | null>(null)

  const [loading, setLoading] = useState(true)

  const generation = useRef({ value: 0 })

  const reload = useCallback(async () => {
    const request = ++generation.current.value

    setLoading(true)

    const result = await services.menu.execute(slug)

    if (request !== generation.current.value) return null

    if (result.ok) {
      setMenu(result.value)
      setError(null)
    } else setError(result.error)

    setLoading(false)

    return result.ok ? result.value : null
  }, [services, slug])

  useEffect(() => {
    const sequence = generation.current
    void reload()
    return () => {
      sequence.value++
    }
  }, [reload])

  const restaurantId = menu?.restaurant.id

  useEffect(
    () =>
      restaurantId
        ? services.menu.subscribe(restaurantId, () => {
            void reload()
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
    <MenuContext.Provider value={{ menu, error, loading, reload }}>
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
