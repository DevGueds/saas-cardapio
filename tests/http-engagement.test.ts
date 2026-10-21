import { afterEach, describe, expect, it, vi } from "vitest"
import { HttpEngagement } from "../src/modules/engagement/infrastructure/http-engagement"
import { Executor } from "../src/shared/application/execute"
import { ApiClient } from "../src/shared/infrastructure/api-client"

const target = {
  slug: "loja-teste",
  orderId: "order-id",
  token: "a".repeat(64),
}
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
}
const service = () =>
  new HttpEngagement(
    new ApiClient(
      "http://localhost:3001/api/v1",
      new Executor({ record: vi.fn() }, { next: () => "diagnostic-id" }),
    ),
  )
function respond(body: unknown, status = 200) {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  )
  vi.stubGlobal("fetch", fetcher)
  return fetcher
}

afterEach(() => vi.unstubAllGlobals())

describe("notification HTTP contracts", () => {
  it.each([
    ["consent", (api: HttpEngagement) => api.consent(target, true)],
    ["revoke consent", (api: HttpEngagement) => api.consent(target, false)],
    ["customer push", (api: HttpEngagement) => api.push(target, subscription)],
    [
      "remove customer push",
      (api: HttpEngagement) => api.push(target, subscription, true),
    ],
    [
      "staff push",
      (api: HttpEngagement) => api.push({ restaurantId: "store" }, subscription),
    ],
    [
      "remove staff push",
      (api: HttpEngagement) => api.push({ restaurantId: "store" }, subscription, true),
    ],
    [
      "mark inbox read",
      (api: HttpEngagement) => api.read("store", "2026-10-21T12:00:00.000Z"),
    ],
  ])(
    "accepts the JSON response of %s without a value property",
    async (_name, action) => {
      // Operation.run returns { ok: true, value: undefined }; JSON omits value.
      respond({ ok: true, value: undefined })
      const result = await action(service())
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toBeUndefined()
    },
  )

  it("sends the explicit preference with the order token", async () => {
    const fetcher = respond({ ok: true })
    await service().consent(target, false)
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/orders/${target.orderId}/notifications`),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "X-Order-Token": target.token }),
        body: JSON.stringify({ whatsapp: false }),
      }),
    )
  })

  it.each([
    { ok: true, value: null },
    { ok: true, value: { saved: false } },
    { ok: true, extra: "unexpected" },
    { ok: true, error: "unexpected" },
    {},
  ])("rejects malformed acknowledgements: %j", async (body) => {
    respond(body)
    const result = await service().consent(target, true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("CORRUPT_DATA")
  })

  it("still requires the payload of read operations and respects failed HTTP status", async () => {
    respond({ ok: true })
    const result = await service().preferences(target)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("CORRUPT_DATA")
    respond({ ok: true }, 503)
    const failed = await service().consent(target, true)
    expect(failed.ok).toBe(false)
  })

  it("preserves the server error when consent cannot be saved", async () => {
    const error = {
      code: "NOT_FOUND",
      message: "Pedido indisponível ou link expirado.",
      fields: {},
      diagnosticId: "server-reference",
    }
    respond({ ok: false, error }, 404)
    expect(await service().consent(target, true)).toEqual({ ok: false, error })
  })
})
