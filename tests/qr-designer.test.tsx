import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import QrDesigner from "../src/shared/presentation/QrDesigner"
import { Failure } from "../src/shared/domain/failure"
const mock = vi.hoisted(() => ({
  prepare: vi.fn(),
  download: vi.fn(),
  png: vi.fn(),
  data: vi.fn(),
}))
vi.mock("../src/shared/presentation/qr-image", () => ({
  prepareQrLogo: mock.prepare,
  downloadQr: mock.download,
  qrPng: mock.png,
}))
vi.mock("qr-code-styling", () => ({
  default: class {
    getRawData = mock.data
  },
}))
beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:test-qr")
      static revokeObjectURL = vi.fn()
    },
  )
  mock.prepare.mockReset().mockResolvedValue("data:image/png;base64,normalized")
  mock.data.mockReset().mockResolvedValue(new Blob(["<svg/>"]))
  mock.png.mockReset().mockResolvedValue(new Blob(["PNG"]))
  mock.download.mockReset()
})
afterEach(() => vi.unstubAllGlobals())
it("includes a logo arriving after mount, recovers from an invalid image and exports the generated blob without loading the logo again", async () => {
  const user = userEvent.setup()
  const view = render(
    <QrDesigner title="Cardápio" url="https://example.test/menu" logo="" />,
  )
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Baixar PNG" })).toBeEnabled(),
  )
  mock.prepare.mockRejectedValueOnce(new Failure("VALIDATION", "Logo indisponível"))
  view.rerender(
    <QrDesigner title="Cardápio" url="https://example.test/menu" logo="invalid" />,
  )
  expect(screen.getByLabelText("Incluir logo da loja")).toBeChecked()
  await screen.findByText("Logo indisponível")
  expect(screen.getByRole("button", { name: "Baixar PNG" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Tentar gerar novamente" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Baixar PNG" })).toBeEnabled(),
  )
  const loads = mock.prepare.mock.calls.length
  await user.click(screen.getByRole("button", { name: "Baixar PNG" }))
  await waitFor(() => expect(mock.download).toHaveBeenCalledTimes(1))
  expect(mock.prepare).toHaveBeenCalledTimes(loads)
  expect(mock.download.mock.calls[0]![1]).toBe("cardapio.png")
})
it("ignores a stale logo failure after the user disables it", async () => {
  let reject!: (error: Error) => void
  mock.prepare.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  render(<QrDesigner title="Cardápio" url="https://example.test/menu" logo="slow" />)
  await waitFor(() => expect(mock.prepare).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByLabelText("Incluir logo da loja"))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Baixar SVG" })).toBeEnabled(),
  )
  await act(async () => reject(new Error("stale image failure")))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Baixar SVG" })).toBeEnabled()
})
