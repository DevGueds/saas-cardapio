import { browserExecutor } from "../browser-executor"
import { useRef, useState } from "react"

import type { AppError, Result } from "../application/result"

export function useMutation() {
  const gate = useRef(false)

  const [pending, setPending] = useState(false)

  const [error, setError] = useState<AppError | null>(null)

  async function run<T>(
    action: () => Promise<Result<T>>,
  ): Promise<Result<T> | undefined> {
    if (gate.current) return undefined

    gate.current = true
    setPending(true)
    setError(null)

    try {
      const outcome = await browserExecutor.run("presentation", "mutation", action)
      const result = outcome.ok ? outcome.value : outcome

      if (!result.ok) setError(result.error)

      return result
    } finally {
      gate.current = false
      setPending(false)
    }
  }

  return { pending, error, run, clearError: () => setError(null) }
}
