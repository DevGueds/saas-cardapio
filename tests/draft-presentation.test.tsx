import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { expect, it } from "vitest"
import { z } from "zod"
import DraftsProvider, { useDraft } from "../src/shared/presentation/DraftsProvider"
import { createReduxDrafts } from "../src/shared/infrastructure/redux-drafts"
import { TestStorage } from "./helpers"

const schema = z.object({ name: z.string(), quantity: z.number() })

it("keeps draft updates stable, reads consecutive changes and isolates empty store drafts", () => {
  const storage = new TestStorage()
  const manager = createReduxDrafts(() => storage)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DraftsProvider manager={manager}>{children}</DraftsProvider>
  )
  const { result, rerender } = renderHook(
    ({ store }) =>
      useDraft(`api:customer:${store}:cart`, { name: store, quantity: 0 }, schema.parse),
    { wrapper, initialProps: { store: "store-a" } },
  )
  const update = result.current.set
  rerender({ store: "store-a" })
  expect(result.current.set).toBe(update)
  // Neither store has a saved entry. Memoization must still change the initial values.
  rerender({ store: "store-b" })
  expect(result.current.value).toEqual({ name: "store-b", quantity: 0 })
  act(() => {
    result.current.set((value) => ({ ...value, quantity: value.quantity + 1 }))
    result.current.set((value) => ({ ...value, quantity: value.quantity + 1 }))
  })
  expect(result.current.value.quantity).toBe(2)
  expect(manager.snapshot("api:customer:store-a:cart")).toBeUndefined()
  expect(manager.snapshot("api:customer:store-b:cart")?.value).toEqual({
    name: "store-b",
    quantity: 2,
  })
})
