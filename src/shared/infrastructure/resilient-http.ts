import { errorSchema } from "@cardapio/contracts"
import { beginConnectionRetry } from "../browser-connectivity"
import { Failure } from "../domain/failure"

export interface HttpReply {
  status: number
  ok: boolean
  body: unknown
}
export interface HttpRequest {
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}
const transientStatuses = new Set([408, 429, 502, 503, 504])
const orderPath = /\/api\/v1\/public\/restaurants\/[a-z0-9]+(?:-[a-z0-9]+)*\/orders$/
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const unavailable = () =>
  new Failure(
    "STORAGE_UNAVAILABLE",
    "Não foi possível confirmar a conexão com a loja. Tente novamente; os dados desta tela foram preservados.",
  )

/** Network Information is an optional hint. Safari/Firefox use the same safe defaults. */
export function connectionProfile() {
  const info =
    typeof navigator === "undefined"
      ? undefined
      : (
          navigator as Navigator & {
            connection?: { effectiveType?: string; rtt?: number; saveData?: boolean }
          }
        ).connection
  const slow =
    info?.saveData ||
    ["slow-2g", "2g", "3g"].includes(info?.effectiveType ?? "") ||
    (info?.rtt ?? 0) >= 600
  return {
    concurrency: slow ? 2 : 4,
    attemptMs: slow ? 35000 : 20000,
    totalMs: slow ? 90000 : 60000,
  }
}

/** A Retry-After deadline is never shortened to fit our own request budget. */
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (value === null || !value.trim()) return null
  if (/^\d+$/.test(value.trim())) {
    const seconds = Number(value)
    return Number.isFinite(seconds) ? seconds * 1000 : Number.POSITIVE_INFINITY
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(value.trim())) return null
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : null
}

function deadline(ms: number, parent?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, ms)
  parent?.addEventListener("abort", abort, { once: true })
  if (parent?.aborted) abort()
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener("abort", abort)
    },
  }
}
function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(unavailable())
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort)
      reject(unavailable())
    }
    signal.addEventListener("abort", abort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener("abort", abort)
        reject(error)
      },
    )
  })
}
function waitToRetry(signal: AbortSignal, delayMs: number, serverDelay: number | null) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const earliest = Date.now() + (serverDelay ?? 0)
    const dispose = () => {
      clearTimeout(timer)
      window.removeEventListener("online", wake)
      signal.removeEventListener("abort", abort)
    }
    const finish = () => {
      dispose()
      resolve()
    }
    const abort = () => {
      dispose()
      reject(unavailable())
    }
    const wake = () => {
      if (Date.now() < earliest) {
        clearTimeout(timer)
        timer = setTimeout(wake, earliest - Date.now())
        return
      }
      // onLine is only a hint: the first request is always allowed. After a failed
      // request it saves retries while the browser explicitly reports disconnection.
      if (typeof navigator === "undefined" || navigator.onLine !== false) finish()
    }
    window.addEventListener("online", wake)
    signal.addEventListener("abort", abort, { once: true })
    timer = setTimeout(wake, delayMs)
    if (signal.aborted) abort()
  })
}
type Waiting = { start(): void }

/** Bounds sockets, queued work and full-body deadlines; retries only proven safe requests. */
export class ResilientHttp {
  private active = 0
  private readonly queue: Waiting[] = []
  private readonly reads = new Map<string, Promise<HttpReply>>()

  invalidateReads() {
    this.reads.clear()
  }

  request(url: string, request: HttpRequest): Promise<HttpReply> {
    if (request.method !== "GET") this.invalidateReads()
    // Share only reads currently in flight, including credentials/token scope.
    // No result, response stream or private payload is retained after completion.
    const key =
      request.method === "GET" && !request.signal
        ? JSON.stringify([
            url,
            Object.entries(request.headers).sort(([a], [b]) => a.localeCompare(b)),
          ])
        : null
    if (key && this.reads.has(key)) return this.reads.get(key)!
    const pending = this.perform(url, request)
    if (request.method !== "GET") {
      const invalidate = () => this.invalidateReads()
      void pending.then(invalidate, invalidate)
    }
    if (key) {
      this.reads.set(key, pending)
      const remove = () => {
        if (this.reads.get(key) === pending) this.reads.delete(key)
      }
      void pending.then(remove, remove)
    }
    return pending
  }

  private acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(unavailable())
    if (this.active < connectionProfile().concurrency) {
      this.active++
      return Promise.resolve(() => this.release())
    }
    if (this.queue.length >= 64) return Promise.reject(unavailable())
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = this.queue.indexOf(waiting)
        if (index >= 0) this.queue.splice(index, 1)
        signal.removeEventListener("abort", abort)
        reject(unavailable())
      }
      const waiting = {
        start: () => {
          signal.removeEventListener("abort", abort)
          this.active++
          resolve(() => this.release())
        },
      }
      this.queue.push(waiting)
      signal.addEventListener("abort", abort, { once: true })
      if (signal.aborted) abort()
    })
  }
  private release() {
    this.active--
    while (this.active < connectionProfile().concurrency && this.queue.length)
      this.queue.shift()!.start()
  }

  private async perform(url: string, request: HttpRequest): Promise<HttpReply> {
    const safe =
      request.method === "GET" ||
      (request.method === "POST" &&
        orderPath.test(url) &&
        uuid.test(request.headers["Idempotency-Key"] ?? ""))
    const profile = connectionProfile()
    // Large image uploads need time on mobile uplinks, but are never replayed.
    const largeUpload = request.method !== "GET" && (request.body?.length ?? 0) >= 128000
    const totalMs = largeUpload ? 120000 : safe ? profile.totalMs : profile.attemptMs
    const operation = deadline(totalMs, request.signal),
      endsAt = Date.now() + totalMs
    let endRetry: (() => void) | undefined
    try {
      for (let attempt = 0; attempt < (safe ? 3 : 1); attempt++) {
        if (operation.signal.aborted) throw unavailable()
        const release = await this.acquire(operation.signal)
        const turn = deadline(
          Math.min(
            largeUpload ? totalMs : profile.attemptMs,
            Math.max(1, endsAt - Date.now()),
          ),
          operation.signal,
        )
        let reply: HttpReply | undefined,
          after: number | null = null
        let failure: Failure = unavailable(),
          retry = false
        try {
          const response = await bounded(
            fetch(url, {
              method: request.method,
              headers: request.headers,
              body: request.body,
              credentials: "include",
              cache: "no-store",
              redirect: "error",
              signal: turn.signal,
            }),
            turn.signal,
          )
          after = retryAfterMs(response.headers.get("Retry-After"))
          try {
            const body: unknown = await bounded(response.json(), turn.signal)
            reply = { body, status: response.status, ok: response.ok }
            const error =
              typeof body === "object" &&
              body !== null &&
              "ok" in body &&
              body.ok === false &&
              "error" in body
                ? errorSchema.safeParse(body.error)
                : null
            retry =
              transientStatuses.has(response.status) &&
              (!error?.success ||
                ["STORAGE_UNAVAILABLE", "RATE_LIMITED"].includes(error.data.code))
          } catch (error) {
            retry =
              transientStatuses.has(response.status) ||
              (response.ok && !(error instanceof SyntaxError))
            failure = transientStatuses.has(response.status)
              ? response.status === 429
                ? new Failure(
                    "RATE_LIMITED",
                    "A loja está recebendo muitas solicitações. Aguarde um pouco e tente novamente.",
                  )
                : unavailable()
              : error instanceof SyntaxError
                ? new Failure(
                    "CORRUPT_DATA",
                    "A API retornou uma resposta inválida. Tente novamente em instantes.",
                  )
                : unavailable()
          }
        } catch {
          retry = true
        } finally {
          turn.dispose()
          release()
        }
        if (!safe || !retry || attempt === 2 || operation.signal.aborted) {
          if (operation.signal.aborted) throw unavailable()
          if (reply) return reply
          throw failure
        }
        const jitter = 500 * 2 ** attempt * (0.5 + Math.random() * 0.5)
        const delay = Math.max(jitter, after ?? 0)
        if (delay >= endsAt - Date.now()) {
          if (reply) return reply
          throw failure
        }
        endRetry ??= beginConnectionRetry()
        await waitToRetry(operation.signal, delay, after)
      }
      throw unavailable()
    } finally {
      operation.dispose()
      endRetry?.()
    }
  }
}
