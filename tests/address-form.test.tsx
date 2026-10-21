import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { it, expect, vi } from "vitest"
import DeliveryAddressForm from "../src/modules/checkout/presentation/DeliveryAddressForm"
import ValidatedForm from "../src/shared/presentation/form-validation/ValidatedForm"
import { sampleAddress } from "./address-fixture"
function Form({ submit }: { submit(): void }) {
  const [address, setAddress] = useState({ ...sampleAddress(), number: "" })
  return (
    <ValidatedForm
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <DeliveryAddressForm value={address} onChange={setAddress} regionLocked={false} />
      <button>Enviar</button>
    </ValidatedForm>
  )
}
it("focuses missing house number, requires rural reference and apartment complement, then accepts correction", () => {
  const submit = vi.fn()
  render(<Form submit={submit} />)
  const send = () =>
    fireEvent.submit(screen.getByRole("button", { name: "Enviar" }).closest("form")!)
  send()
  expect(screen.getByLabelText(/Número do imóvel/)).toHaveFocus()
  expect(submit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText("Sem número"))
  send()
  expect(screen.getByLabelText(/Ponto de referência/)).toHaveFocus()
  fireEvent.change(screen.getByLabelText(/Ponto de referência/), {
    target: { value: "Portão azul ao lado da escola" },
  })
  fireEvent.change(screen.getByLabelText("Tipo de local"), {
    target: { value: "APARTMENT" },
  })
  send()
  expect(screen.getByLabelText(/Complemento/)).toHaveFocus()
  fireEvent.change(screen.getByLabelText(/Complemento/), {
    target: { value: "Bloco B apartamento 12" },
  })
  send()
  expect(submit).toHaveBeenCalledOnce()
})
