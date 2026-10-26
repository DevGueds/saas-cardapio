import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import ReceiptLayoutEditor from "../src/modules/printing/presentation/ReceiptLayoutEditor"

afterEach(() => vi.unstubAllGlobals())

it("integrates the real Editor.js with plain controls without interpreting or rewriting text", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  const onChange = vi.fn()
  const view = render(
    <ReceiptLayoutEditor
      kind="KITCHEN"
      template={{
        blocks: [
          { type: "section", data: { section: "items" } },
          { type: "text", data: { text: "A & B", align: "left" } },
        ],
      }}
      logo=""
      onLogoChange={vi.fn()}
      onChange={onChange}
    />,
  )
  await waitFor(
    () => expect(screen.getByRole("button", { name: "Adicionar bloco" })).toBeEnabled(),
    { timeout: 5000 },
  )
  const input = screen.getByLabelText("Texto (até 500 caracteres)")
  fireEvent.input(input, { target: { value: "Café & pão, R$ 12,00" } })
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      blocks: [
        { type: "section", data: { section: "items" } },
        { type: "text", data: { text: "Café & pão, R$ 12,00", align: "left" } },
      ],
    }),
  )
  onChange.mockClear()
  fireEvent.input(input, { target: { value: '<img src="x" onerror="alert(1)">' } })
  await screen.findByText(/Revise os blocos/)
  expect(view.container.querySelector("img")).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
  expect(input).toHaveValue('<img src="x" onerror="alert(1)">')
})
