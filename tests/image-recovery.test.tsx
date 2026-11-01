import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import ImageWithFallback from "../src/shared/presentation/ImageWithFallback"

it("retries a failed image when the connection returns and disposes its recovery listener", async () => {
  vi.useFakeTimers()
  try {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
    const view = render(
      <ImageWithFallback src="https://example.test/food.png" alt="Lanche" />,
    )
    fireEvent.error(screen.getByAltText("Lanche"))
    expect(
      screen.getByRole("img", { name: "Lanche — imagem indisponível" }),
    ).toBeInTheDocument()
    await act(async () => {
      online.mockReturnValue(false)
      window.dispatchEvent(new Event("offline"))
      online.mockReturnValue(true)
      window.dispatchEvent(new Event("online"))
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(screen.getByAltText("Lanche")).toHaveAttribute("decoding", "async")
    fireEvent.error(screen.getByAltText("Lanche"))
    window.dispatchEvent(new Event("focus"))
    view.unmount()
    await vi.advanceTimersByTimeAsync(2000)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
    vi.restoreAllMocks()
  }
})
