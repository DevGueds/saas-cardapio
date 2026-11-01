import { afterEach, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { ApiClient } from "../src/shared/infrastructure/api-client"
import {
  ResilientHttp,
  connectionProfile,
  retryAfterMs,
  type HttpRequest,
} from "../src/shared/infrastructure/resilient-http"
import { getConnectionRetryCount } from "../src/shared/browser-connectivity"
import { Executor } from "../src/shared/application/execute"

const url = "https://store.example/api/v1/configuration"
const order = "https://store.example/api/v1/public/restaurants/cozinha/orders"
const key = randomUUID()
const get: HttpRequest = { method: "GET", headers: {} }
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
const errorBody = (code = "STORAGE_UNAVAILABLE") => ({
  ok: false,
  error: { code, message: "Tente novamente.", fields: {}, diagnosticId: "server-ref" },
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("recovers HTML gateway errors and a broken response stream using bounded retries", async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("gateway", { status: 503 }))
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError("connection closed"))
          },
        }),
      ),
    )
    .mockResolvedValueOnce(json({ ok: true, value: 42 }))
  vi.stubGlobal("fetch", fetcher)
  const pending = new ResilientHttp().request(url, get)
  await vi.advanceTimersByTimeAsync(2000)
  expect((await pending).body).toEqual({ ok: true, value: 42 })
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(getConnectionRetryCount()).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})

it("replays an idempotent order with identical serialized body and key after a lost response", async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("lost response"))
    .mockResolvedValueOnce(json({ ok: true }))
  vi.stubGlobal("fetch", fetcher)
  const request: HttpRequest = {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ cart: { lines: [1] } }),
  }
  const pending = new ResilientHttp().request(order, request)
  await vi.advanceTimersByTimeAsync(2000)
  expect((await pending).ok).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body)
  expect(fetcher.mock.calls[0][1].headers).toEqual(fetcher.mock.calls[1][1].headers)
})

it.each([
  ["POST", url, { "Idempotency-Key": key }],
  ["POST", order, {}],
  ["POST", order, { "Idempotency-Key": "invalid" }],
  ["PUT", url, { "Idempotency-Key": key }],
  ["DELETE", url, {}],
] as const)(
  "never automatically repeats an unsafe %s to %s",
  async (method, target, headers) => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"))
    vi.stubGlobal("fetch", fetcher)
    await expect(
      new ResilientHttp().request(target, { method, headers }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" })
    expect(fetcher).toHaveBeenCalledOnce()
  },
)

it.each([400, 401, 403, 409, 422, 500])(
  "does not replay a definitive HTTP %i response",
  async (status) => {
    const fetcher = vi.fn(async () => json(errorBody("VALIDATION"), status))
    vi.stubGlobal("fetch", fetcher)
    expect((await new ResilientHttp().request(url, get)).status).toBe(status)
    expect(fetcher).toHaveBeenCalledOnce()
  },
)

it("does not retry unavailable capabilities or malformed successful JSON", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json(errorBody("CAPABILITY_UNAVAILABLE"), 503))
    .mockResolvedValueOnce(new Response("invalid-json"))
  vi.stubGlobal("fetch", fetcher)
  const transport = new ResilientHttp()
  expect((await transport.request(url, get)).status).toBe(503)
  await expect(transport.request(url, get)).rejects.toMatchObject({
    code: "CORRUPT_DATA",
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it("honors Retry-After across online events and refuses to retry earlier than a long server deadline", async () => {
  vi.useFakeTimers()
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(json(errorBody("RATE_LIMITED"), 429, { "Retry-After": "2" }))
    .mockResolvedValueOnce(json({ ok: true }))
    .mockResolvedValueOnce(json(errorBody(), 503, { "Retry-After": "120" }))
  vi.stubGlobal("fetch", fetcher)
  const transport = new ResilientHttp()
  const pending = transport.request(url, get)
  await vi.advanceTimersByTimeAsync(1)
  window.dispatchEvent(new Event("online"))
  await vi.advanceTimersByTimeAsync(1998)
  expect(fetcher).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  await pending
  expect(fetcher).toHaveBeenCalledTimes(2)
  const limited = await transport.request(url, get)
  expect(limited.status).toBe(503)
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(vi.getTimerCount()).toBe(0)
})

it("suspends retries offline, resumes online and always releases listeners and timers", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(json({ ok: true }))
  vi.stubGlobal("fetch", fetcher)
  const pending = new ResilientHttp().request(url, get)
  await vi.advanceTimersByTimeAsync(10000)
  expect(fetcher).toHaveBeenCalledOnce()
  online.mockReturnValue(true)
  window.dispatchEvent(new Event("online"))
  await pending
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(getConnectionRetryCount()).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})

it("bounds even a stalled body, releases its slot and supports browsers without AbortSignal.timeout", async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn(async () => ({
    status: 200,
    ok: true,
    headers: new Headers(),
    json: () => new Promise(() => {}),
  }))
  vi.stubGlobal("fetch", fetcher)
  const pending = new ResilientHttp()
    .request(url, { method: "PUT", headers: {} })
    .catch((error) => error)
  await vi.advanceTimersByTimeAsync(20001)
  expect(await pending).toMatchObject({ code: "STORAGE_UNAVAILABLE" })
  expect(vi.getTimerCount()).toBe(0)
})

it("coalesces 100 simultaneous reads but isolates different tokens, aborts, and later sessions", async () => {
  const resolvers: Array<(value: Response) => void> = []
  const fetcher = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
  vi.stubGlobal("fetch", fetcher)
  const client = new ApiClient(
    "https://store.example/api/v1",
    new Executor({ record: vi.fn() }, { next: () => "reference" }),
  )
  const reads = Array.from({ length: 100 }, () =>
    client.request("/configuration", z.number()),
  )
  await Promise.resolve()
  expect(fetcher).toHaveBeenCalledOnce()
  resolvers.shift()!(json({ ok: true, value: 42 }))
  expect(
    (await Promise.all(reads)).every((result) => result.ok && result.value === 42),
  ).toBe(true)
  const one = client.request("/private", z.number(), { trackingToken: "first" })
  const two = client.request("/private", z.number(), { trackingToken: "second" })
  await Promise.resolve()
  expect(fetcher).toHaveBeenCalledTimes(3)
  for (const resolve of resolvers.splice(0)) resolve(json({ ok: true, value: 1 }))
  await Promise.all([one, two])
  const old = client.request("/auth/session", z.number())
  client.setCsrf("new-session")
  const fresh = client.request("/auth/session", z.number())
  await Promise.resolve()
  expect(fetcher).toHaveBeenCalledTimes(5)
  for (const resolve of resolvers.splice(0)) resolve(json({ ok: true, value: 2 }))
  await Promise.all([old, fresh])
})

it("limits distinct concurrent work, cancels queued requests and adapts to slow connections", async () => {
  vi.stubGlobal("navigator", { onLine: true, connection: { effectiveType: "2g" } })
  expect(connectionProfile().concurrency).toBe(2)
  expect(connectionProfile().attemptMs).toBe(35000)
  const resolvers: Array<(value: Response) => void> = []
  const fetcher = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)))
  vi.stubGlobal("fetch", fetcher)
  const transport = new ResilientHttp(),
    abort = new AbortController()
  const first = transport.request(url + "?one", get),
    second = transport.request(url + "?two", get)
  const third = transport
    .request(url + "?three", { ...get, signal: abort.signal })
    .catch((error) => error)
  await Promise.resolve()
  expect(fetcher).toHaveBeenCalledTimes(2)
  abort.abort()
  expect(await third).toMatchObject({ code: "STORAGE_UNAVAILABLE" })
  for (const resolve of resolvers.splice(0)) resolve(json({ ok: true }))
  await Promise.all([first, second])
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it("a read after a confirmed write never joins an older response that is still in flight", async () => {
  let finishOld!: (value: Response) => void
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishOld = resolve
        }),
    )
    .mockImplementationOnce(async () => json({ ok: true, value: "saved" }))
    .mockImplementationOnce(async () => json({ ok: true, value: "new" }))
  vi.stubGlobal("fetch", fetcher)
  const transport = new ResilientHttp()
  const old = transport.request(url, get)
  await Promise.resolve()
  await transport.request(url, { method: "PUT", headers: {}, body: "{}" })
  expect((await transport.request(url, get)).body).toEqual({ ok: true, value: "new" })
  finishOld(json({ ok: true, value: "old" }))
  await old
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it("parses server deadlines without treating negative or malformed numbers as dates", () => {
  const now = Date.parse("2026-11-01T12:00:00Z")
  expect(retryAfterMs("3", now)).toBe(3000)
  expect(retryAfterMs("Sun, 01 Nov 2026 12:00:04 GMT", now)).toBe(4000)
  expect(retryAfterMs("-1", now)).toBeNull()
  expect(retryAfterMs("1.2", now)).toBeNull()
  expect(retryAfterMs("", now)).toBeNull()
})
