import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, it, expect, vi } from "vitest"
import PushButton from "../src/modules/engagement/presentation/PushButton"
const services = vi.hoisted(() => ({
  engagement: { pushConfiguration: vi.fn(), push: vi.fn() },
  devicePush: { unsupported: vi.fn(), subscribe: vi.fn(), current: vi.fn() },
}))
vi.mock("../src/app/presentation/ServicesProvider", () => ({
  useServices: () => services,
}))
beforeEach(() => {
  vi.resetAllMocks()
  services.devicePush.unsupported.mockReturnValue(null)
})
it("recovers configuration failures without reloading the page or requesting permission early", async () => {
  services.engagement.pushConfiguration
    .mockResolvedValueOnce({
      ok: false,
      error: {
        code: "CAPABILITY_UNAVAILABLE",
        message: "Serviço temporariamente indisponível.",
        fields: {},
        diagnosticId: "test",
      },
    })
    .mockResolvedValueOnce({ ok: true, value: { enabled: true, publicKey: "test-key" } })
  services.devicePush.subscribe.mockResolvedValue({
    ok: true,
    value: { endpoint: "test" },
  })
  services.engagement.push.mockResolvedValue({ ok: true })
  render(<PushButton target={{ restaurantId: "store" }} />)
  await screen.findByRole("alert")
  const activate = screen.getByRole("button", { name: "Ativar ou renovar alertas" })
  expect(activate).toBeDisabled()
  expect(services.devicePush.subscribe).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole("button", { name: "Atualizar dados e tentar novamente" }),
  )
  await waitFor(() => expect(activate).toBeEnabled())
  fireEvent.click(activate)
  await waitFor(() =>
    expect(services.engagement.push).toHaveBeenCalledWith(
      { restaurantId: "store" },
      { endpoint: "test" },
    ),
  )
  expect(services.devicePush.subscribe).toHaveBeenCalledWith("test-key")
})
it("explains unsupported local HTTP and disables both unavailable actions", async () => {
  services.devicePush.unsupported.mockReturnValue(
    "Use HTTPS para ativar alertas neste aparelho.",
  )
  services.engagement.pushConfiguration.mockResolvedValue({
    ok: true,
    value: { enabled: true, publicKey: "test-key" },
  })
  render(<PushButton target={{ restaurantId: "store" }} />)
  await waitFor(() =>
    expect(services.engagement.pushConfiguration).toHaveBeenCalledOnce(),
  )
  expect(screen.getByText("Use HTTPS para ativar alertas neste aparelho.")).toBeVisible()
  expect(screen.getByRole("button", { name: "Ativar ou renovar alertas" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Desativar alertas" })).toBeDisabled()
  expect(services.devicePush.current).not.toHaveBeenCalled()
})
