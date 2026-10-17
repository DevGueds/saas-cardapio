import { test } from "node:test"
import assert from "node:assert/strict"
import { CachedMenu } from "../../src/modules/catalog/infrastructure/cached-menu.js"
import type { CacheStore } from "../../src/shared/application/cache.js"
import type { MenuRepository } from "../../src/modules/catalog/application/ports.js"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { Failure } from "@cardapio/domain/failure"
const menu: MenuDocument = {
  schemaVersion: 1,
  revision: 0,
  restaurant: {
    id: "store",
    slug: "test-store",
    name: "Store",
    description: "",
    whatsapp: "",
    whatsappConfigured: false,
    address: "",
    logoUrl: "",
    coverUrl: "",
    deliveryFee: 0,
    minOrder: 0,
    eta: "30 min",
    isOpen: true,
  },
  products: [],
  categories: [],
}
function setup() {
  const values = new Map<string, string>()
  let reads = 0
  const cache: CacheStore = {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => {
      values.set(k, v)
    },
    delete: async (k) => {
      values.delete(k)
    },
  }
  const scope = { tenantId: "tenant", restaurantId: "store" }
  const repository: MenuRepository = {
    resolve: async () => scope,
    load: async () => {
      reads++
      return structuredClone(menu)
    },
    commit: async (_s, _r, next) => next,
  }
  return {
    values,
    cache,
    scope,
    repository,
    reads: () => reads,
    subject: new CachedMenu(repository, cache),
  }
}
test("public cache collapses concurrent reads but private reads stay authoritative", async () => {
  const s = setup()
  const results = await Promise.all(
    Array.from({ length: 20 }, () => s.subject.publicMenu("test-store")),
  )
  assert.equal(s.reads(), 1)
  assert.equal(results.length, 20)
  await s.subject.publicMenu("test-store")
  assert.equal(s.reads(), 1)
  await s.subject.load(s.scope)
  assert.equal(s.reads(), 2)
  await s.subject.commit(s.scope, 0, { ...menu, revision: 1 })
  assert.equal(s.values.size, 0)
})
test("corrupt or cross-store cache fails closed without falling back", async () => {
  for (const raw of [
    "{",
    JSON.stringify({ ...menu, restaurant: { ...menu.restaurant, slug: "other-store" } }),
  ]) {
    const s = setup()
    s.values.set("menu:test-store", raw)
    await assert.rejects(
      () => s.subject.publicMenu("test-store"),
      (e) => e instanceof Failure && e.code === "CORRUPT_DATA",
    )
    assert.equal(s.reads(), 0)
  }
})
test("cache failure is observable and never silently returns invented data", async () => {
  const s = setup()
  s.cache.get = async () => {
    throw new Failure("STORAGE_UNAVAILABLE", "Unavailable")
  }
  await assert.rejects(
    () => s.subject.publicMenu("test-store"),
    (e) => e instanceof Failure && e.code === "STORAGE_UNAVAILABLE",
  )
  assert.equal(s.reads(), 0)
})
