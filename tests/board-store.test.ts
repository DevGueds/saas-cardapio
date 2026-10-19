import { it, expect } from "vitest"
import { BoardStore } from "../src/modules/engagement/application/board-store"
it("only notifies the changed order and columns whose membership changed", () => {
  const store = new BoardStore(),
    a = { id: "a", status: "NEW" as const, createdAt: "2026-10-19T12:00:00Z" },
    b = { ...a, id: "b" }
  store.snapshot({ name: "Loja", orders: [a, b], truncated: false })
  const stableB = store.get("b"),
    stableReady = store.column("READY")
  let changedA = 0,
    changedB = 0,
    newColumn = 0,
    preparingColumn = 0,
    meta = 0
  store.subscribe("a", () => changedA++)
  store.subscribe("b", () => changedB++)
  store.subscribe("column:NEW", () => newColumn++)
  store.subscribe("column:PREPARING", () => preparingColumn++)
  store.subscribe("meta", () => meta++)
  store.delta({
    name: "Loja",
    truncated: false,
    upsert: [{ ...a, status: "PREPARING" }],
    remove: [],
  })
  expect({ changedA, changedB, newColumn, preparingColumn, meta }).toEqual({
    changedA: 1,
    changedB: 0,
    newColumn: 1,
    preparingColumn: 1,
    meta: 0,
  })
  expect(store.get("b")).toBe(stableB)
  expect(store.column("READY")).toBe(stableReady)
  store.snapshot({
    name: "Loja",
    orders: [{ ...a, status: "PREPARING" }, b],
    truncated: false,
  })
  expect(changedA).toBe(1)
  store.delta({ name: "Loja", truncated: false, upsert: [], remove: ["a"] })
  expect(store.get("a")).toBeUndefined()
  expect(store.column("PREPARING")).toEqual([])
})
