import { afterEach, expect, it, vi } from "vitest"
import { waitForNetworkRetry } from "../src/shared/infrastructure/network-retry"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it("does not reconnect while offline and wakes immediately when connectivity returns", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  const finished = vi.fn()
  const waiting = waitForNetworkRetry(new AbortController().signal, 3000).then(finished)
  await vi.advanceTimersByTimeAsync(60000)
  expect(finished).not.toHaveBeenCalled()
  online.mockReturnValue(true)
  window.dispatchEvent(new Event("online"))
  await waiting
  expect(finished).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it("cancels pending waits on navigation, including when already aborted", async () => {
  vi.useFakeTimers()
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  const controller = new AbortController()
  const waiting = waitForNetworkRetry(controller.signal, 3000)
  controller.abort()
  await waiting
  await waitForNetworkRetry(controller.signal, 3000)
  expect(vi.getTimerCount()).toBe(0)
})

it("honors retry delay online but suspends if connectivity disappears during that delay", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  const finished = vi.fn()
  const controller = new AbortController()
  const waiting = waitForNetworkRetry(controller.signal, 3000).then(finished)
  await vi.advanceTimersByTimeAsync(2999)
  expect(finished).not.toHaveBeenCalled()
  online.mockReturnValue(false)
  await vi.advanceTimersByTimeAsync(10000)
  expect(finished).not.toHaveBeenCalled()
  controller.abort()
  await waiting
  expect(finished).toHaveBeenCalledOnce()
})
