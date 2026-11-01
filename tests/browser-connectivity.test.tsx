import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import {
  beginConnectionRetry,
  getConnectionRetryCount,
  subscribeConnectionRecovery,
} from "../src/shared/browser-connectivity"
import ConnectionNotice from "../src/shared/presentation/ConnectionNotice"

afterEach(() => {
  vi.useRealTimers()
})

it("coalesces browser resume events and pauses recovery while offline or hidden", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible")
  const recovered = vi.fn()
  const unsubscribe = subscribeConnectionRecovery(recovered)
  window.dispatchEvent(new Event("focus"))
  await vi.advanceTimersByTimeAsync(1000)
  expect(recovered).not.toHaveBeenCalled()
  online.mockReturnValue(true)
  window.dispatchEvent(new Event("online"))
  window.dispatchEvent(new Event("focus"))
  document.dispatchEvent(new Event("visibilitychange"))
  await vi.advanceTimersByTimeAsync(249)
  expect(recovered).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(recovered).toHaveBeenCalledOnce()
  visibility.mockReturnValue("hidden")
  document.dispatchEvent(new Event("visibilitychange"))
  window.dispatchEvent(new Event("focus"))
  await vi.advanceTimersByTimeAsync(1000)
  expect(recovered).toHaveBeenCalledOnce()
  visibility.mockReturnValue("visible")
  document.dispatchEvent(new Event("visibilitychange"))
  await vi.advanceTimersByTimeAsync(250)
  expect(recovered).toHaveBeenCalledTimes(2)
  window.dispatchEvent(new Event("focus"))
  unsubscribe()
  await vi.advanceTimersByTimeAsync(5000)
  expect(recovered).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it("explains offline and retry states without hiding content or promising a saved action", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  render(<ConnectionNotice />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  let first!: () => void
  let second!: () => void
  act(() => {
    first = beginConnectionRetry()
    second = beginConnectionRetry()
  })
  expect(screen.getByRole("status")).toHaveTextContent(
    "Conexão instável. Tentando novamente…",
  )
  act(() => {
    first()
    first()
  })
  expect(getConnectionRetryCount()).toBe(1)
  act(() => {
    online.mockReturnValue(false)
    window.dispatchEvent(new Event("offline"))
  })
  expect(screen.getByRole("status")).toHaveTextContent("Sem conexão com a internet")
  expect(screen.getByRole("status")).toHaveTextContent("Reconecte-se para salvar")
  act(() => {
    second()
    online.mockReturnValue(true)
    window.dispatchEvent(new Event("online"))
  })
  expect(getConnectionRetryCount()).toBe(0)
  expect(screen.getByRole("status")).toHaveTextContent("Conexão disponível")
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})
