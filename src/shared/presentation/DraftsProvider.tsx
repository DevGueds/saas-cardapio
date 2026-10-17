import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type SetStateAction,
} from "react"
import { DRAFT_TTL, type DraftManager } from "../application/drafts"
const Context = createContext<DraftManager | null>(null)
export default function DraftsProvider({
  manager,
  children,
}: {
  manager: DraftManager
  children: ReactNode
}) {
  useEffect(() => {
    const receive = (event: StorageEvent) => manager.receive(event.key, event.newValue)
    window.addEventListener("storage", receive)
    return () => window.removeEventListener("storage", receive)
  }, [manager])
  return <Context.Provider value={manager}>{children}</Context.Provider>
}
export function useDraft<T>(
  key: string,
  initial: T,
  parse: (value: unknown) => T,
  ttlMs = DRAFT_TTL,
) {
  const manager = useContext(Context)
  if (!manager) throw new Error("DraftsProvider is required")
  const fallback = useRef({ key, value: initial })
  if (fallback.current.key !== key) fallback.current = { key, value: initial }
  const entry = useSyncExternalStore(manager.subscribe, () => manager.snapshot(key))
  const decoded = useMemo(() => {
    if (!entry) return { value: fallback.current.value, invalid: false }
    try {
      return { value: parse(entry.value), invalid: false }
    } catch {
      return { value: fallback.current.value, invalid: true }
    }
  }, [entry, parse])
  const set = (value: SetStateAction<T>) => {
    let current = decoded.value
    try {
      const entry = manager.snapshot(key)
      if (entry) current = parse(entry.value)
    } catch {
      /* Preserve the rendered draft when invalid. */
    }
    return manager.set(
      key,
      typeof value === "function" ? (value as (previous: T) => T)(current) : value,
      ttlMs,
    )
  }
  return {
    value: decoded.value,
    set,
    clear: () => {
      fallback.current = { key, value: initial }
      manager.clear(key)
    },
    reset: (value: T) => {
      fallback.current = { key, value }
      manager.clear(key)
    },
    saved: !!entry && !entry.issue && !decoded.invalid,
    issue:
      entry?.issue ??
      (decoded.invalid
        ? "O rascunho contém campos inválidos. Descarte-o para continuar."
        : null),
  }
}
