import { describe, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"
import type { ErrorCode } from "../src/shared/domain/failure"
import { Executor } from "../src/shared/application/execute"
import { ApiClient } from "../src/shared/infrastructure/api-client"
import { createReduxDrafts } from "../src/shared/infrastructure/redux-drafts"
import { sha256Fingerprint } from "../src/shared/infrastructure/sha256-fingerprint"
import { DRAFT_TTL } from "../src/shared/application/drafts"
import { HttpCheckout } from "../src/modules/checkout/infrastructure/http-checkout"
import { TestStorage } from "./helpers"

const attemptKey = "api:customer:store-a:attempt"
const orderKey = randomUUID()
const receipt = {
  orderId: "81df0b04-92c8-48a9-93ef-34f915daeb6d",
  revision: 2,
  trackingToken: "a".repeat(64),
  url: "",
}
const cart = { restaurantId: "store-a", lines: [] }
const details = {
  name: "Cliente",
  phone: "11999999999",
  address: "Rua de teste",
  notes: "",
  payment: "Pix" as const,
  cashChange: "",
}
const failure = (code: ErrorCode) => ({
  ok: false as const,
  error: { code, message: "Tente novamente.", fields: {}, diagnosticId: "test" },
})
function setup(storage = new TestStorage(), now = () => 1_000) {
  const executor = new Executor({ record: vi.fn() }, { next: () => "diagnostic" })
  const client = new ApiClient("http://localhost:3001/api/v1", executor)
  const drafts = createReduxDrafts(() => storage, now)
  const next = vi.fn(() => orderKey)
  const checkout = new HttpCheckout(
    client,
    (id) => id,
    executor,
    drafts,
    { next },
    sha256Fingerprint,
  )
  return { checkout, client, drafts, next, storage }
}

describe("checkout on intermittent connections", () => {
  it("recovers a committed order after a lost response followed by rate limiting", async () => {
    const first = setup()
    const request = vi
      .spyOn(first.client, "request")
      .mockResolvedValueOnce(failure("STORAGE_UNAVAILABLE"))
      // The first order can still be committing when recovery checks for it.
      .mockResolvedValueOnce({ ok: true, value: null })
      .mockResolvedValueOnce(failure("RATE_LIMITED"))
    await first.checkout.execute("store-a", 2, cart, details)
    await first.checkout.execute("store-a", 2, cart, details)
    expect(first.checkout.hasPending("store-a")).toBe(true)
    expect(request.mock.calls.map((call) => call[2]?.idempotencyKey)).toEqual([
      orderKey,
      orderKey,
      orderKey,
    ])
    const reloaded = setup(first.storage)
    const recover = vi
      .spyOn(reloaded.client, "request")
      .mockResolvedValue({ ok: true, value: receipt })
    expect(await reloaded.checkout.recover("store-a")).toEqual({
      ok: true,
      value: receipt,
    })
    expect(recover.mock.calls[0][2]?.idempotencyKey).toBe(orderKey)
    expect(reloaded.next).not.toHaveBeenCalled()
  })

  it("preserves the pending identity beyond a day without storing customer details", async () => {
    let at = 1_000
    const first = setup(new TestStorage(), () => at)
    vi.spyOn(first.client, "request").mockResolvedValue(failure("STORAGE_UNAVAILABLE"))
    await first.checkout.execute("store-a", 2, cart, details)
    expect(first.drafts.snapshot(attemptKey)?.expiresAt).toBe(at + 30 * DRAFT_TTL)
    const persisted = [...first.storage.values.values()].join("")
    expect(persisted).not.toContain(details.name)
    expect(persisted).not.toContain(details.phone)
    expect(persisted).not.toContain(details.address)
    at += 2 * DRAFT_TTL
    const reloaded = setup(first.storage, () => at)
    expect(reloaded.checkout.hasPending("store-a")).toBe(true)
    vi.spyOn(reloaded.client, "request").mockResolvedValue({ ok: true, value: receipt })
    expect(await reloaded.checkout.recover("store-a")).toEqual({
      ok: true,
      value: receipt,
    })
  })

  it("shares the persisted idempotency key during concurrent local submissions", async () => {
    const { checkout, client, next } = setup()
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const request = vi
      .spyOn(client, "request")
      .mockImplementation(async (_path, _schema, options) => {
        if (options?.method !== "POST") return { ok: true, value: null }
        await pending
        return { ok: true, value: receipt }
      })
    const first = checkout.execute("store-a", 2, cart, details)
    const second = checkout.execute("store-a", 2, cart, details)
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    finish()
    const results = await Promise.all([first, second])
    expect(results.every((result) => result.ok)).toBe(true)
    const posts = request.mock.calls.filter((call) => call[2]?.method === "POST")
    expect(posts).toHaveLength(2)
    expect(new Set(posts.map((call) => call[2]?.idempotencyKey))).toEqual(
      new Set([orderKey]),
    )
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("blocks an altered order while its original outcome remains uncertain", async () => {
    const { checkout, client, drafts } = setup()
    const request = vi
      .spyOn(client, "request")
      .mockResolvedValueOnce(failure("STORAGE_UNAVAILABLE"))
      .mockResolvedValueOnce({ ok: true, value: null })
    await checkout.execute("store-a", 2, cart, details)
    const original = drafts.snapshot(attemptKey)?.value
    const changed = await checkout.execute("store-a", 2, cart, {
      ...details,
      notes: "Alterado",
    })
    expect(changed.ok).toBe(false)
    if (!changed.ok) expect(changed.error.code).toBe("CONFLICT")
    expect(request.mock.calls.filter((call) => call[2]?.method === "POST")).toHaveLength(
      1,
    )
    expect(drafts.snapshot(attemptKey)?.value).toEqual(original)
  })

  it("never submits when the browser cannot preserve the attempt", async () => {
    const { checkout, client, storage } = setup()
    storage.writeError = new Error("quota")
    const request = vi.spyOn(client, "request")
    const result = await checkout.execute("store-a", 2, cart, details)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("STORAGE_UNAVAILABLE")
    expect(request).not.toHaveBeenCalled()
  })
})
