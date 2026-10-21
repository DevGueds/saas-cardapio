import { test } from "node:test"
import assert from "node:assert/strict"
import { BrasilApiAddress } from "../../src/modules/delivery/infrastructure/brasil-api-address.js"
import { Failure } from "@cardapio/domain/failure"
const cep = "01001000"
const via = {
  cep: "01001-000",
  uf: "SP",
  localidade: "São Paulo",
  bairro: "Sé",
  logradouro: "Praça da Sé",
  complemento: "lado ímpar",
}
function fixture(
  primary: () => Promise<unknown>,
  secondary: () => Promise<unknown>,
  cached: string | null = null,
) {
  const calls = { primary: 0, fallback: 0, writes: 0 }
  const provider = new BrasilApiAddress(
    {
      getJson: async () => {
        calls.primary++
        return primary()
      },
    },
    {
      get: async () => cached,
      set: async (_, value, ttl) => {
        assert.equal(ttl, 86400)
        cached = value
        calls.writes++
      },
      delete: async () => {},
    },
    { consume: async () => {} },
    {
      getJson: async () => {
        calls.fallback++
        return secondary()
      },
    },
  )
  return { provider, calls }
}
test("postal lookup fails over to ViaCEP, caches verified data and never infers apartment or coordinates", async () => {
  const { provider, calls } = fixture(
    async () => {
      throw new Failure("CAPABILITY_UNAVAILABLE", "offline")
    },
    async () => via,
  )
  const address = await provider.lookup(cep)
  assert.equal(address.street, "Praça da Sé")
  assert.equal(address.latitude, null)
  assert.equal("complement" in address, false)
  assert.deepEqual(await provider.lookup(cep), address)
  assert.deepEqual(calls, { primary: 1, fallback: 1, writes: 1 })
})
test("valid primary data repairs corrupt cache, bounds coordinates and avoids fallback", async () => {
  const { provider, calls } = fixture(
    async () => ({
      cep,
      state: "SP",
      city: "São Paulo",
      location: { coordinates: { latitude: " ", longitude: "181" } },
    }),
    async () => {
      throw new Error("unused")
    },
    "{",
  )
  const result = await provider.lookup(cep)
  assert.equal(result.latitude, null)
  assert.equal(result.longitude, null)
  assert.equal(result.street, "")
  assert.equal(calls.fallback, 0)
  assert.equal(calls.writes, 1)
})
test("unknown and malformed CEPs remain actionable and never get cached", async () => {
  for (const erro of [true, "true"]) {
    const { provider, calls } = fixture(
      async () => {
        throw new Failure("NOT_FOUND", "missing")
      },
      async () => ({ erro }),
    )
    await assert.rejects(
      () => provider.lookup(cep),
      (error) => error instanceof Failure && error.code === "NOT_FOUND",
    )
    await assert.rejects(() => provider.lookup("../other"))
    assert.deepEqual(calls, { primary: 1, fallback: 1, writes: 0 })
  }
})
test("mismatched CEP responses are rejected and upstream details stay private", async () => {
  const { provider, calls } = fixture(
    async () => ({ private: "sensitive" }),
    async () => ({ ...via, cep: "99999-999" }),
  )
  await assert.rejects(
    () => provider.lookup(cep),
    (error) =>
      error instanceof Failure &&
      error.code === "CAPABILITY_UNAVAILABLE" &&
      !error.message.includes("sensitive"),
  )
  assert.equal(calls.writes, 0)
})
test("rate limiting cannot be bypassed through the fallback provider", async () => {
  const { provider, calls } = fixture(
    async () => {
      throw new Failure("RATE_LIMITED", "limit")
    },
    async () => via,
  )
  await assert.rejects(
    () => provider.lookup(cep),
    (error) => error instanceof Failure && error.code === "RATE_LIMITED",
  )
  assert.equal(calls.fallback, 0)
})
