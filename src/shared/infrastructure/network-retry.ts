/** Suspend reconnects while offline; resume early on connectivity and dispose on abort. */
export function waitForNetworkRetry(signal: AbortSignal, delayMs: number): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(timer)
      window.removeEventListener("online", finish)
      signal.removeEventListener("abort", finish)
      resolve()
    }
    window.addEventListener("online", finish, { once: true })
    signal.addEventListener("abort", finish, { once: true })
    if (navigator.onLine)
      timer = setTimeout(() => {
        if (navigator.onLine) finish()
      }, delayMs)
    if (signal.aborted) finish()
  })
}
