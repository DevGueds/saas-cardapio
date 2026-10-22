import { act, renderHook, waitFor } from "@testing-library/react"
import { it, expect, vi } from "vitest"
import type { Result } from "@cardapio/contracts"
import { useResource } from "../src/shared/presentation/use-resource"
const success = (value: string): Result<string> => ({ ok: true, value })
const failed: Result<string> = {
  ok: false,
  error: {
    code: "STORAGE_UNAVAILABLE",
    message: "Indisponível",
    fields: {},
    diagnosticId: "test",
  },
}
it("hides the previous restaurant immediately and ignores its late replies and reload callbacks", async () => {
  let resolveFirst!: (value: Result<string>) => void,
    resolveSecond!: (value: Result<string>) => void
  const first = vi.fn(async () => success("Loja A")),
    second = vi.fn(
      () =>
        new Promise<Result<string>>((resolve) => {
          resolveSecond = resolve
        }),
    )
  const hook = renderHook(({ load }) => useResource(load), {
    initialProps: { load: first as () => Promise<Result<string>> },
  })
  await waitFor(() => expect(hook.result.current.data).toBe("Loja A"))
  first.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
  )
  const oldReload = hook.result.current.reload
  let pending!: Promise<void>
  act(() => {
    pending = oldReload()
  })
  hook.rerender({ load: second })
  expect(hook.result.current.data).toBeNull()
  expect(hook.result.current.loading).toBe(true)
  await act(async () => {
    resolveSecond(success("Loja B"))
  })
  await act(async () => {
    resolveFirst(success("Loja A antiga"))
    await pending
    await oldReload()
  })
  expect(hook.result.current.data).toBe("Loja B")
  expect(first).toHaveBeenCalledTimes(2)
})
it("keeps the current result on a same-scope refresh failure and supports recovery", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(success("Saldo confirmado"))
    .mockResolvedValueOnce(failed)
    .mockResolvedValueOnce(success("Saldo atualizado"))
  const { result } = renderHook(() => useResource<string>(load))
  await waitFor(() => expect(result.current.data).toBe("Saldo confirmado"))
  await act(async () => result.current.reload())
  expect(result.current.data).toBe("Saldo confirmado")
  expect(result.current.error?.code).toBe("STORAGE_UNAVAILABLE")
  await act(async () => result.current.reload())
  expect(result.current.data).toBe("Saldo atualizado")
  expect(result.current.error).toBeNull()
})
it("discards requests after unmount and makes saved reload callbacks inactive", async () => {
  let resolve!: (value: Result<string>) => void
  const load = vi.fn(
    () =>
      new Promise<Result<string>>((done) => {
        resolve = done
      }),
  )
  const hook = renderHook(() => useResource(load)),
    reload = hook.result.current.reload
  hook.unmount()
  await act(async () => {
    resolve(success("Obsoleto"))
    await reload()
  })
  expect(load).toHaveBeenCalledOnce()
})
