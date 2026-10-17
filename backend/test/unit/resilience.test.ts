import { test } from "node:test"
import assert from "node:assert/strict"
import { Bulkhead } from "../../src/shared/application/bulkhead.js"
import { ResilientHttp } from "../../src/shared/infrastructure/resilient-http.js"
import { Failure } from "@cardapio/domain/failure"
test("bulkhead bounds work and releases capacity on rejection without queues", async () => {
  const gate = new Bulkhead(1),
    release = gate.enter()
  assert.throws(() => gate.enter(), Failure)
  assert.equal(gate.inFlight, 1)
  release()
  release()
  assert.equal(gate.inFlight, 0)
  await assert.rejects(() =>
    gate.run(async () => {
      throw new Error("failed")
    }),
  )
  assert.equal(gate.inFlight, 0)
})
test("upstream retries GET finitely, opens circuit, probes and recovers", async () => {
  let calls = 0,
    now = 100,
    healthy = false
  const transport = (async () => {
    calls++
    if (!healthy) throw new Error("private upstream cause")
    return new Response(JSON.stringify({ ok: true }))
  }) as typeof fetch
  const client = new ResilientHttp(
    { timeoutMs: 100, concurrency: 1, failureThreshold: 1, cooldownMs: 1000 },
    transport,
    () => now,
  )
  await assert.rejects(
    () => client.getJson("https://upstream.test"),
    (error) => error instanceof Failure && error.code === "CAPABILITY_UNAVAILABLE",
  )
  assert.equal(calls, 2)
  await assert.rejects(() => client.getJson("https://upstream.test"))
  assert.equal(calls, 2)
  now = 1200
  healthy = true
  assert.deepEqual(await client.getJson("https://upstream.test"), { ok: true })
  assert.equal(calls, 3)
})
test("unknown addresses are not retried and invalid JSON never becomes success", async () => {
  let calls = 0
  const notFound = new ResilientHttp(
    { timeoutMs: 100, concurrency: 1, failureThreshold: 1, cooldownMs: 1000 },
    (async () => {
      calls++
      return new Response("{}", { status: 404 })
    }) as typeof fetch,
  )
  await assert.rejects(
    () => notFound.getJson("https://upstream.test"),
    (error) => error instanceof Failure && error.code === "NOT_FOUND",
  )
  assert.equal(calls, 1)
  const invalid = new ResilientHttp(
    { timeoutMs: 100, concurrency: 1, failureThreshold: 1, cooldownMs: 1000 },
    (async () => new Response("{")) as typeof fetch,
  )
  await assert.rejects(() => invalid.getJson("https://upstream.test"))
})
