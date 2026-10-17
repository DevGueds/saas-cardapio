import { test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID, randomBytes } from "node:crypto"
import { RedisStore, RedisLimiter } from "../../src/shared/infrastructure/redis.js"
import { NodeSecrets } from "../../src/shared/infrastructure/runtime.js"
import { Failure } from "@cardapio/domain/failure"
const url = process.env.REDIS_URL
if (!url || !process.env.TEST_DATABASE_URL?.includes("_test"))
  throw new Error("Test services required")
test("Redis shares atomic rate limits across replicas and an outage fails closed", async () => {
  const namespace = "test:resilience:" + randomUUID(),
    a = new RedisStore(url, namespace),
    b = new RedisStore(url, namespace),
    secrets = new NodeSecrets(randomBytes(32).toString("hex"))
  try {
    await Promise.all([a.connect(), b.connect()])
    const first = new RedisLimiter(a, secrets),
      second = new RedisLimiter(b, secrets)
    const requests = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? first : second).consume("same-client", 5, 3),
      ),
    )
    assert.equal(requests.filter((r) => r.status === "fulfilled").length, 5)
    for (const r of requests)
      if (r.status === "rejected")
        assert.equal((r.reason as Failure).code, "RATE_LIMITED")
    await a.set("menu:test", "snapshot", 10)
    assert.equal(await b.get("menu:test"), "snapshot")
    await b.delete("menu:test")
    assert.equal(await a.get("menu:test"), null)
    b.close()
    await assert.rejects(
      () => second.consume("same-client", 5, 3),
      (e) => e instanceof Failure && e.code === "STORAGE_UNAVAILABLE",
    )
  } finally {
    a.close()
    b.close()
  }
})
