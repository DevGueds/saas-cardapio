import { browserExecutor } from "../browser-executor"
import { toast } from "react-toastify"
import { useCallback, useRef, useState } from "react"

import type { AppError, Result } from "../application/result"

export function useMutation() {
  const gate = useRef(false)

  const [pending, setPending] = useState(false)

  const [error, setError] = useState<AppError | null>(null)

  const run = useCallback(async function run<T>(
    action: () => Promise<Result<T>>,
    successMessage?: string,
  ): Promise<Result<T> | undefined> {
    if (gate.current) return undefined

    gate.current = true
    setPending(true)
    setError(null)

    try {
      const outcome = await browserExecutor.run("presentation", "mutation", action)
      const result = outcome.ok ? outcome.value : outcome

      if (!result.ok) {
        setError(result.error)
        toast.error("Não foi possível confirmar a ação. Confira os detalhes na tela.", {
          toastId: result.error.diagnosticId,
          autoClose: 8000,
          role: "status",
        })
      } else if (successMessage) toast.success(successMessage, { role: "status" })

      return result
    } finally {
      gate.current = false
      setPending(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])
  return { pending, error, run, clearError }
}
