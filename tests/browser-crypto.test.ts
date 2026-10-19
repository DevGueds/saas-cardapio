import { createHash, webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { browserIds } from "../src/shared/infrastructure/browser-ids"
import { sha256Fingerprint } from "../src/shared/infrastructure/sha256-fingerprint"
import { Executor } from "../src/shared/application/execute"
import { Failure } from "../src/shared/domain/failure"

afterEach(() => vi.unstubAllGlobals())

describe("portable browser cryptography", () => {
  it("uses native UUID when supported", () => {
    const native = vi.fn(() => "a0f1264c-9f8b-4a3e-a964-1f7e9b190ee6")
    vi.stubGlobal("crypto", { randomUUID: native, getRandomValues: vi.fn() })
    expect(browserIds.next()).toBe(native.mock.results[0].value)
    expect(native).toHaveBeenCalledTimes(1)
  })

  it("generates distinct UUID v4 using secure entropy on HTTP without randomUUID", () => {
    const random = vi.fn((bytes: Uint8Array) => webcrypto.getRandomValues(bytes))
    vi.stubGlobal("crypto", { getRandomValues: random })
    const ids = Array.from({ length: 100 }, () => browserIds.next())
    expect(new Set(ids).size).toBe(100)
    for (const id of ids) {
      expect(z.uuidv4().safeParse(id).success).toBe(true)
      expect(id).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      )
    }
    expect(random).toHaveBeenCalledTimes(100)
  })

  it.each([undefined, {}])(
    "fails closed without a source of secure randomness (%j)",
    (source) => {
      vi.stubGlobal("crypto", source)
      expect(() => browserIds.next()).toThrow(Failure)
      try {
        browserIds.next()
      } catch (error) {
        expect(error).toMatchObject({ code: "CAPABILITY_UNAVAILABLE" })
      }
    },
  )

  it.each(["", "abc", "Açaí — São José 👩🏽‍🍳", "x".repeat(32768)])(
    "preserves SHA-256 fingerprints without SubtleCrypto",
    async (value) => {
      vi.stubGlobal("crypto", {
        getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
      })
      expect(await sha256Fingerprint.digest(value)).toBe(
        createHash("sha256").update(value, "utf8").digest("hex"),
      )
    },
  )

  it("returns a safe failure even when diagnostic ID generation also fails", async () => {
    vi.stubGlobal("crypto", undefined)
    const logger = { record: vi.fn() }
    const executor = new Executor(logger, browserIds)
    const result = await executor.run("checkout", "submit", async () => browserIds.next())
    expect(result).toMatchObject({
      ok: false,
      error: { code: "CAPABILITY_UNAVAILABLE", diagnosticId: "diagnostic-unavailable" },
    })
    expect(logger.record).toHaveBeenCalledOnce()
  })
})
