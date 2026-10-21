import { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, it, expect, vi } from "vitest"
import PostalCodeLookup from "../src/app/presentation/PostalCodeLookup"
const maps = vi.hoisted(() => ({ lookup: vi.fn() }))
vi.mock("../src/app/presentation/ServicesProvider", () => ({
  useServices: () => ({ maps }),
}))
const address = {
  cep: "01001000",
  state: "SP",
  city: "São Paulo",
  neighborhood: "Sé",
  street: "Praça da Sé",
  latitude: null,
  longitude: null,
}
beforeEach(() => maps.lookup.mockReset())
function Form({ found }: { found: (value: unknown) => void }) {
  const [cep, setCep] = useState("01001000")
  return (
    <PostalCodeLookup
      value={cep}
      onChange={setCep}
      onFound={found}
      contextKey="checkout"
    />
  )
}
it("automatically queries on blur, deduplicates blur plus click, and preserves manual fields on outage", async () => {
  let resolve!: (value: unknown) => void
  maps.lookup.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const found = vi.fn()
  render(<Form found={found} />)
  fireEvent.blur(screen.getByLabelText("CEP (opcional)"))
  fireEvent.click(screen.getByRole("button", { name: "Buscando…" }))
  expect(maps.lookup).toHaveBeenCalledTimes(1)
  await act(async () =>
    resolve({
      ok: false,
      error: {
        code: "CAPABILITY_UNAVAILABLE",
        message: "Preencha manualmente.",
        fields: {},
        diagnosticId: "test",
      },
    }),
  )
  expect(screen.getByRole("alert")).toHaveTextContent("Preencha manualmente")
  expect(screen.getByLabelText("CEP (opcional)")).toHaveValue("01001-000")
  expect(found).not.toHaveBeenCalled()
  maps.lookup.mockResolvedValue({ ok: true, value: address })
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  await waitFor(() => expect(found).toHaveBeenCalledWith(address))
})
it("ignores an obsolete CEP response even if it arrives after the next result", async () => {
  let old!: (value: unknown) => void
  maps.lookup
    .mockReturnValueOnce(
      new Promise((r) => {
        old = r
      }),
    )
    .mockResolvedValueOnce({ ok: true, value: { ...address, cep: "01002000" } })
  const found = vi.fn()
  render(<Form found={found} />)
  fireEvent.blur(screen.getByLabelText("CEP (opcional)"))
  fireEvent.change(screen.getByLabelText("CEP (opcional)"), {
    target: { value: "01002000" },
  })
  fireEvent.blur(screen.getByLabelText("CEP (opcional)"))
  await waitFor(() => expect(found).toHaveBeenCalledOnce())
  await act(async () => old({ ok: true, value: address }))
  expect(found).toHaveBeenCalledTimes(1)
  expect(found).toHaveBeenCalledWith({ ...address, cep: "01002000" })
})
it("never applies lookup data after the form has closed", async () => {
  let resolve!: (value: unknown) => void
  maps.lookup.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  const found = vi.fn(),
    view = render(<Form found={found} />)
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  view.unmount()
  await act(async () => resolve({ ok: true, value: address }))
  expect(found).not.toHaveBeenCalled()
})

it("can retry after changing away and back while the original request is pending", async () => {
  let resolve!: (value: unknown) => void
  maps.lookup
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      }),
    )
    .mockResolvedValueOnce({ ok: true, value: address })
  const found = vi.fn()
  render(<Form found={found} />)
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  fireEvent.change(screen.getByLabelText("CEP (opcional)"), {
    target: { value: "01002000" },
  })
  fireEvent.change(screen.getByLabelText("CEP (opcional)"), {
    target: { value: "01001000" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  await waitFor(() => expect(found).toHaveBeenCalledOnce())
  await act(async () => resolve({ ok: true, value: { ...address, street: "Obsoleto" } }))
  expect(found).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "Buscar CEP" })).toBeEnabled()
})
