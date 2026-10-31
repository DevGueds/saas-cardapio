import { afterEach, expect, it, vi } from "vitest"
import { HttpIdentity } from "../src/modules/identity/infrastructure/http-identity"
import { ApiClient } from "../src/shared/infrastructure/api-client"
import { Executor } from "../src/shared/application/execute"

afterEach(() => vi.unstubAllGlobals())
const identity = () =>
  new HttpIdentity(
    new ApiClient(
      "http://localhost/api/v1",
      new Executor({ record: vi.fn() }, { next: () => "test-reference" }),
    ),
  )
function respond(value: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, value }), {
          headers: { "Content-Type": "application/json" },
        }),
    ),
  )
}
it("accepts additive server configuration during independent API and web deployments", async () => {
  respond({
    signupEnabled: true,
    emailSendEnabled: false,
    futureSetting: { enabled: true },
  })
  expect(await identity().configuration()).toEqual({
    ok: true,
    value: { signupEnabled: true, emailSendEnabled: false },
  })
})
it.each([
  { signupEnabled: "true" },
  { emailSendEnabled: false },
  { signupEnabled: true, emailSendEnabled: "false" },
])("rejects invalid configuration values: %j", async (value) => {
  respond(value)
  const result = await identity().configuration()
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe("CORRUPT_DATA")
})
