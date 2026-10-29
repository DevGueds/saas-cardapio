import { browserIds } from "../src/shared/infrastructure/browser-ids"
import { sha256Fingerprint } from "../src/shared/infrastructure/sha256-fingerprint"
import { webcrypto } from "node:crypto"
import { createReduxDrafts } from "../src/shared/infrastructure/redux-drafts"
import { TestStorage, sampleMenu } from "./helpers"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { Executor } from "../src/shared/application/execute"
import { ApiClient } from "../src/shared/infrastructure/api-client"
import { HttpCheckout } from "../src/modules/checkout/infrastructure/http-checkout"
import { HttpCatalog } from "../src/modules/catalog/infrastructure/http-catalog"
import { MenuRefresh } from "../src/modules/catalog/infrastructure/menu-refresh"
const executor = () => new Executor({ record: vi.fn() }, { next: () => "diagnostic-id" })
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
describe("HTTP adapters fail closed", () => {
  it("publishes the confirmed menu before a write resolves, isolating stores and external invalidation", async () => {
    const menu = { ...sampleMenu(), revision: 8 }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true, value: menu })))
    vi.stubGlobal("BroadcastChannel", undefined)
    const refresh = new MenuRefresh()
    const listener = vi.fn(),
      otherStore = vi.fn()
    const stop = refresh.subscribe(menu.restaurant.id, listener)
    const stopOther = refresh.subscribe("another-store", otherStore)
    try {
      const catalog = new HttpCatalog(
        new ApiClient("http://localhost:3001/api/v1", executor()),
        refresh,
      )
      const result = await catalog.setOpen(menu.restaurant.id, 7, menu.restaurant.isOpen)
      expect(result.ok).toBe(true)
      expect(listener).toHaveBeenCalledExactlyOnceWith(menu)
      expect(otherStore).not.toHaveBeenCalled()
      window.dispatchEvent(new Event("focus"))
      expect(listener).toHaveBeenLastCalledWith()
      stop()
      listener.mockClear()
      refresh.changed(menu.restaurant.id, menu)
      expect(listener).not.toHaveBeenCalled()
    } finally {
      stop()
      stopOther()
      vi.unstubAllGlobals()
    }
  })
  it("invalid configuration never sends a request", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const result = await new ApiClient(
      "http://untrusted.example/api/v1",
      executor(),
    ).request("/auth/session", z.unknown())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("CONFIGURATION")
    expect(fetcher).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it("transport errors and malformed successful responses never become success", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("private payload"))
      .mockResolvedValueOnce(response({ ok: true, value: { unexpected: true } }))
    vi.stubGlobal("fetch", fetcher)
    const client = new ApiClient("http://localhost:3001/api/v1", executor())
    const offline = await client.request(
      "/configuration",
      z.object({ signupEnabled: z.boolean() }),
    )
    const malformed = await client.request(
      "/configuration",
      z.object({ signupEnabled: z.boolean() }),
    )
    expect(offline.ok).toBe(false)
    expect(malformed.ok).toBe(false)
    expect(JSON.stringify(offline)).not.toContain("private payload")
    if (!malformed.ok) expect(malformed.error.code).toBe("CORRUPT_DATA")
    vi.unstubAllGlobals()
  })
  it("preserves server diagnostics and attaches cookies/CSRF only through the transport", async () => {
    const failure = {
      code: "CONFLICT",
      message: "Atualize os dados.",
      fields: {},
      diagnosticId: "server-reference",
    }
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ ok: false, error: failure }, 409))
    vi.stubGlobal("fetch", fetcher)
    const client = new ApiClient("http://localhost:3001/api/v1", executor())
    client.setCsrf("csrf-in-memory")
    const result = await client.request("/restaurants/store/open", z.unknown(), {
      method: "PUT",
      body: { isOpen: true },
    })
    expect(result).toEqual({ ok: false, error: failure })
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "include",
      redirect: "error",
      headers: { "X-CSRF-Token": "csrf-in-memory" },
    })
    vi.unstubAllGlobals()
  })
  it("a lost checkout response reuses the attempt key and keeps restaurants isolated", async () => {
    const result = {
      ok: true,
      value: { orderId: "b788a508-7aa7-4e03-a1f4-cb063ec23a09", url: "", revision: 1 },
    }
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(async () => response(result))
    vi.stubGlobal("fetch", fetcher)
    vi.stubGlobal("crypto", {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    })
    const storage = new TestStorage()
    const client = new ApiClient("http://localhost:3001/api/v1", executor()),
      checkout = new HttpCheckout(
        client,
        (id) => id,
        executor(),
        createReduxDrafts(() => storage),
        browserIds,
        sha256Fingerprint,
      )
    const details = {
      name: "Teste",
      phone: "11999999999",
      address: "Rua de teste",
      notes: "",
      payment: "Pix" as const,
      cashChange: "",
    }
    const cart = { restaurantId: "store-a", lines: [] }
    await checkout.execute("store-a", 1, cart, details)
    await new HttpCheckout(
      client,
      (id) => id,
      executor(),
      createReduxDrafts(() => storage),
      browserIds,
      sha256Fingerprint,
    ).execute("store-a", 1, cart, details)
    await checkout.execute("store-b", 1, { ...cart, restaurantId: "store-b" }, details)
    const headers = fetcher.mock.calls.map((call) => call[1].headers)
    expect(headers[0]["Idempotency-Key"]).toBe(headers[1]["Idempotency-Key"])
    expect(headers[1]["Idempotency-Key"]).not.toBe(headers[2]["Idempotency-Key"])
    vi.unstubAllGlobals()
  })
  it("recovers a pending receipt independently of cart validity and rejects corrupt attempts", async () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(() => storage)
    const key = "api:customer:store-a:attempt",
      attempt = { signature: "a".repeat(64), key: webcrypto.randomUUID() }
    drafts.set(key, attempt)
    const receipt = {
      orderId: webcrypto.randomUUID(),
      url: "",
      revision: 2,
      trackingToken: "b".repeat(64),
    }
    const fetcher = vi
      .fn()
      .mockImplementation(async () => response({ ok: true, value: receipt }))
    vi.stubGlobal("fetch", fetcher)
    const checkout = new HttpCheckout(
      new ApiClient("http://localhost:3001/api/v1", executor()),
      (id) => id,
      executor(),
      drafts,
      browserIds,
      sha256Fingerprint,
    )
    expect(checkout.hasPending("store-a")).toBe(true)
    expect(await checkout.recover("store-a")).toEqual({ ok: true, value: receipt })
    expect(fetcher.mock.calls[0][1].method).toBe("GET")
    expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(attempt.key)
    drafts.set(key, { key: "invalid" })
    expect((await checkout.recover("store-a")).ok).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
  it("settings serialize only the command fields, excluding entity identity and state", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Atualize.",
            fields: {},
            diagnosticId: "server",
          },
        },
        409,
      ),
    )
    vi.stubGlobal("fetch", fetcher)
    const catalog = new HttpCatalog(
      new ApiClient("http://localhost:3001/api/v1", executor()),
      new MenuRefresh(),
    )
    await catalog.update("store", 3, {
      name: "Loja",
      description: "",
      whatsapp: "",
      address: "",
      logoUrl: "",
      coverUrl: "",
      deliveryFee: "0",
      minOrder: "0",
      eta: "30 min",
      ...{ id: "store", tenantId: "cannot-overwrite", isOpen: true },
    })
    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.expectedRevision).toBe(3)
    expect(body).not.toHaveProperty("id")
    expect(body).not.toHaveProperty("tenantId")
    expect(body).not.toHaveProperty("isOpen")
    vi.unstubAllGlobals()
  })
})
