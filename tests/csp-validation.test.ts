import "../src/app/validation-config"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { ApiClient } from "../src/shared/infrastructure/api-client"
import { Executor } from "../src/shared/application/execute"

afterEach(() => vi.unstubAllGlobals())

it("validates lazy API schemas under a CSP that forbids dynamic code", async () => {
  const evaluate = vi.fn(() => {
    throw new EvalError("unsafe-eval blocked")
  })
  vi.stubGlobal("Function", evaluate)
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, value: { revision: 1, name: "São José" } }),
      ),
    )
  vi.stubGlobal("fetch", fetcher)
  const client = new ApiClient(
    "http://localhost:3001/api/v1",
    new Executor({ record: vi.fn() }, { next: () => "test-reference" }),
  )
  const schema = z.strictObject({
    revision: z.number().int().nonnegative(),
    name: z.string().min(1),
  })
  expect(await client.request("/configuration", schema)).toEqual({
    ok: true,
    value: { revision: 1, name: "São José" },
  })
  expect(schema.safeParse({ revision: -1, name: "" }).success).toBe(false)
  expect(evaluate).not.toHaveBeenCalled()
})
