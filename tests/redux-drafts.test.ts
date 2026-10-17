import { describe, it, expect } from "vitest"
import { createReduxDrafts } from "../src/shared/infrastructure/redux-drafts"
import { DRAFT_PREFIX, DRAFT_TTL } from "../src/shared/application/drafts"
import { TestStorage } from "./helpers"
const key = "api:customer:store:checkout"
describe("Redux draft persistence", () => {
  it("persists synchronously and restores exact partial Unicode input after reload", () => {
    const storage = new TestStorage(),
      first = createReduxDrafts(
        () => storage,
        () => 100,
      )
    const value = { name: "Conceição", price: "1,", address: "São José, nº " }
    expect(first.set(key, value)).toBe(true)
    const reloaded = createReduxDrafts(
      () => storage,
      () => 200,
    )
    expect(reloaded.snapshot(key)?.value).toEqual(value)
  })
  it("preserves empty drafts and isolates restaurants, modes and users", () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(() => storage)
    drafts.set("api:admin:user-a:store-a:product", { name: "A" })
    drafts.set("api:admin:user-b:store-a:product", { name: "B" })
    drafts.set("demo:customer:store-a:cart", { lines: [] })
    drafts.set("api:customer:store-b:cart", { lines: [] })
    const next = createReduxDrafts(() => storage)
    expect(next.snapshot("api:admin:user-a:store-a:product")?.value).toEqual({
      name: "A",
    })
    expect(next.snapshot("api:admin:user-b:store-a:product")?.value).toEqual({
      name: "B",
    })
    expect(next.snapshot("demo:customer:store-a:cart")?.value).toEqual({ lines: [] })
    expect(next.snapshot("api:customer:store-a:cart")).toBeUndefined()
  })
  it("removes expired drafts on hydration without skipping adjacent entries", () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(
        () => storage,
        () => 100,
      )
    drafts.set(key, { name: "A" })
    drafts.set("api:customer:store:cart", { lines: [] })
    const next = createReduxDrafts(
      () => storage,
      () => 101 + DRAFT_TTL,
    )
    expect(next.snapshot(key)).toBeUndefined()
    expect(storage.getItem(DRAFT_PREFIX + key)).toBeNull()
    expect(storage.length).toBe(0)
    expect(next.set(key, { name: "B" })).toBe(true)
  })
  it("corrupt JSON is never overwritten automatically", () => {
    const storage = new TestStorage()
    storage.setItem(DRAFT_PREFIX + key, "{")
    const drafts = createReduxDrafts(() => storage)
    expect(drafts.snapshot(key)?.issue).toContain("validado")
    expect(drafts.set(key, { name: "Changed" })).toBe(false)
    expect(storage.getItem(DRAFT_PREFIX + key)).toBe("{")
    drafts.clear(key)
    expect(drafts.set(key, { name: "New" })).toBe(true)
  })
  it("unsupported versions and invalid expiry fail closed", () => {
    for (const raw of [
      { version: 2, value: {}, updatedAt: 1, expiresAt: 100 },
      { version: 1, value: {}, updatedAt: 100, expiresAt: 1 },
    ]) {
      const storage = new TestStorage()
      storage.setItem(DRAFT_PREFIX + key, JSON.stringify(raw))
      expect(
        createReduxDrafts(
          () => storage,
          () => 1,
        ).snapshot(key)?.issue,
      ).toBeTruthy()
    }
  })
  it("quota failures preserve the in-memory form without reporting saved", () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(() => storage)
    storage.writeError = new Error("quota")
    expect(drafts.set(key, { name: "Still here" })).toBe(false)
    expect(drafts.snapshot(key)?.value).toEqual({ name: "Still here" })
    expect(drafts.snapshot(key)?.issue).toContain("Não foi possível")
    storage.writeError = null
    expect(drafts.set(key, { name: "Saved now" })).toBe(true)
  })
  it("different tabs cannot silently overwrite a dirty draft", () => {
    const storage = new TestStorage(),
      a = createReduxDrafts(() => storage),
      b = createReduxDrafts(() => storage)
    a.set(key, { name: "A" })
    expect(b.set(key, { name: "B" })).toBe(false)
    expect(JSON.parse(storage.getItem(DRAFT_PREFIX + key)!).value.name).toBe("A")
    expect(b.snapshot(key)?.value).toEqual({ name: "B" })
    expect(b.snapshot(key)?.issue).toContain("outra aba")
  })
  it("clean tabs receive changes, dirty tabs retain text and show a conflict", () => {
    const storage = new TestStorage(),
      a = createReduxDrafts(() => storage),
      b = createReduxDrafts(() => storage)
    a.set(key, { name: "A" })
    b.receive(DRAFT_PREFIX + key, storage.getItem(DRAFT_PREFIX + key))
    expect(b.snapshot(key)?.value).toEqual({ name: "A" })
    b.set(key, { name: "B" })
    a.receive(DRAFT_PREFIX + key, storage.getItem(DRAFT_PREFIX + key))
    expect(a.snapshot(key)?.value).toEqual({ name: "A" })
    expect(a.snapshot(key)?.issue).toContain("outra aba")
  })
  it("logout clears admin drafts while customer cart remains", () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(() => storage)
    drafts.set("api:admin:user:store:settings", { name: "Private" })
    drafts.set(key, { name: "Customer" })
    drafts.clearPrefix("api:admin:")
    const next = createReduxDrafts(() => storage)
    expect(next.snapshot("api:admin:user:store:settings")).toBeUndefined()
    expect(next.snapshot(key)?.value).toEqual({ name: "Customer" })
  })
  it("a failed deletion keeps the warning instead of pretending the data was removed", () => {
    const storage = new TestStorage(),
      drafts = createReduxDrafts(() => storage)
    drafts.set(key, { name: "A" })
    storage.writeError = new Error("blocked")
    drafts.clear(key)
    expect(drafts.snapshot(key)?.issue).toBeTruthy()
  })
})
