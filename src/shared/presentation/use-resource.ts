import { useCallback, useEffect, useRef, useState } from "react"
import type { AppError, Result } from "../application/result"
import { browserExecutor } from "../browser-executor"

/** A failed request preserves the last result but callers must disable writes on error. */
export function useResource<T>(load: () => Promise<Result<T>>) {
  const sequence = useRef({ value: 0 })
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const request = ++sequence.current.value
    setLoading(true)
    const outcome = await browserExecutor.run("presentation", "load", load)
    const result = outcome.ok ? outcome.value : outcome
    if (request !== sequence.current.value) return
    if (result.ok) {
      setData(result.value)
      setError(null)
    } else setError(result.error)
    setLoading(false)
  }, [load])
  useEffect(() => {
    const generation = sequence.current
    void reload()
    return () => {
      generation.value++
    }
  }, [reload])
  return { data, error, loading, reload }
}
