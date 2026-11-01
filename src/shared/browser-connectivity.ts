type Listener = () => void

const connectionListeners = new Set<Listener>()
const recoveryListeners = new Set<Listener>()
const retryListeners = new Set<Listener>()
let stopListening: (() => void) | undefined
let retryCount = 0

export function getConnectionSnapshot(): "online" | "offline" {
  return typeof navigator === "undefined" || navigator.onLine !== false
    ? "online"
    : "offline"
}

/** A browser hint, not proof that the API can be reached. */
export function canRefreshConnection() {
  return (
    getConnectionSnapshot() === "online" &&
    (typeof document === "undefined" || document.visibilityState !== "hidden")
  )
}

function listen() {
  if (stopListening || typeof window === "undefined") return
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastRecovery = Number.NEGATIVE_INFINITY
  const cancel = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    if (!canRefreshConnection()) {
      cancel()
      return
    }
    if (timer !== undefined) return
    // Mobile browsers commonly emit online, focus and visible together.
    timer = setTimeout(
      () => {
        timer = undefined
        if (!canRefreshConnection()) return
        lastRecovery = Date.now()
        recoveryListeners.forEach((listener) => listener())
      },
      Math.max(250, 1000 - (Date.now() - lastRecovery)),
    )
  }
  const connection = () => {
    connectionListeners.forEach((listener) => listener())
    schedule()
  }
  window.addEventListener("online", connection)
  window.addEventListener("offline", connection)
  window.addEventListener("focus", schedule)
  document.addEventListener("visibilitychange", schedule)
  stopListening = () => {
    cancel()
    window.removeEventListener("online", connection)
    window.removeEventListener("offline", connection)
    window.removeEventListener("focus", schedule)
    document.removeEventListener("visibilitychange", schedule)
    stopListening = undefined
  }
}

function subscribe(listeners: Set<Listener>, listener: Listener) {
  listeners.add(listener)
  listen()
  return () => {
    listeners.delete(listener)
    if (!connectionListeners.size && !recoveryListeners.size) stopListening?.()
  }
}

export function subscribeConnection(listener: Listener) {
  return subscribe(connectionListeners, listener)
}

/** Revalidate reads after connectivity returns or the user returns to the app. */
export function subscribeConnectionRecovery(listener: Listener) {
  return subscribe(recoveryListeners, listener)
}

export function getConnectionRetryCount() {
  return retryCount
}

export function subscribeConnectionRetry(listener: Listener) {
  retryListeners.add(listener)
  return () => {
    retryListeners.delete(listener)
  }
}

/** Keep concurrent retry notices visible until every request settles. */
export function beginConnectionRetry(): () => void {
  retryCount++
  retryListeners.forEach((listener) => listener())
  let finished = false
  return () => {
    if (finished) return
    finished = true
    retryCount--
    retryListeners.forEach((listener) => listener())
  }
}
