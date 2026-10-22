import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { AppError, Result } from "../application/result"
import { browserExecutor } from "../browser-executor"

/** A failed request preserves the last result but callers must disable writes on error. */
export function useResource<T>(load: () => Promise<Result<T>>) {
  const sequence = useRef({ value: 0 })
  const active = useRef<typeof load | null>(null)
  const [state, setState] = useState<{
    source: typeof load
    data: T | null
    error: AppError | null
    loading: boolean
  }>({ source: load, data: null, error: null, loading: true })
  useLayoutEffect(() => {
    const generation = sequence.current
    active.current = load
    return () => {
      generation.value++
      active.current = null
    }
  }, [load])
  const reload = useCallback(async () => {
    if (active.current !== load) return
    const request = ++sequence.current.value
    setState((previous) => ({
      source: load,
      data: previous.source === load ? previous.data : null,
      error: null,
      loading: true,
    }))
    const outcome = await browserExecutor.run("presentation", "load", load)
    const result = outcome.ok ? outcome.value : outcome
    if (request !== sequence.current.value || active.current !== load) return
    setState((previous) => ({
      source: load,
      data: result.ok ? result.value : previous.source === load ? previous.data : null,
      error: result.ok ? null : result.error,
      loading: false,
    }))
  }, [load])
  useEffect(() => {
    void reload()
  }, [reload])
  // Never expose one restaurant/query's data during a different loader's first render.
  return {
    data: state.source === load ? state.data : null,
    error: state.source === load ? state.error : null,
    loading: state.source !== load || state.loading,
    reload,
  }
}
