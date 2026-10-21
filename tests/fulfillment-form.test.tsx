import { sampleAddress } from "./address-fixture"
import { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import type { CheckoutOptions } from "@cardapio/domain/quote"
import { emptyCommerce } from "@cardapio/domain/commerce"
import { sampleMenu } from "./helpers"
import FulfillmentForm from "../src/modules/checkout/presentation/FulfillmentForm"
import { InputField } from "../src/shared/presentation/Fields"
const maps = vi.hoisted(() => ({ lookup: vi.fn() }))
const menu = {
  ...sampleMenu(),
  commerce: {
    ...emptyCommerce(),
    delivery: {
      ...emptyCommerce().delivery,
      mode: "ZONES" as const,
      zones: [
        {
          id: "center",
          active: true,
          city: "São Paulo",
          state: "SP",
          neighborhood: "Centro",
          fee: 700,
          etaMin: 30,
          etaMax: 60,
          latitude: null,
          longitude: null,
        },
      ],
    },
  },
}
vi.mock("../src/app/presentation/ServicesProvider", () => ({
  useServices: () => ({ maps }),
}))
vi.mock("../src/app/presentation/MenuScope", () => ({ useMenu: () => ({ menu }) }))
function Form() {
  const [address, setAddress] = useState(sampleAddress()),
    [cep, setCep] = useState("01001000"),
    [value, setValue] = useState<CheckoutOptions>({ fulfillment: { mode: "DELIVERY" } })
  return (
    <>
      <FulfillmentForm
        address={address}
        cep={cep}
        value={value}
        onAddress={(found) =>
          setAddress((v) => ({
            ...v,
            street: found.street,
            city: found.city,
            state: found.state,
            neighborhood: found.neighborhood,
            postalCode: found.cep,
          }))
        }
        onCep={setCep}
        onChange={setValue}
        disabled={false}
      />
      <InputField
        label="Endereço"
        value={address.street}
        onChange={(event) => setAddress((v) => ({ ...v, street: event.target.value }))}
      />
      <InputField
        label="Cidade manual"
        value={address.city}
        onChange={(event) => setAddress((v) => ({ ...v, city: event.target.value }))}
      />
    </>
  )
}
const result = {
  ok: true,
  value: {
    cep: "01001000",
    state: "SP",
    city: "SAO PAULO",
    neighborhood: "CENTRO",
    street: "Praça da Sé",
    latitude: -23.55,
    longitude: -46.63,
  },
}
it("matches the neighbourhood returned by CEP and ignores a late result after the address changes", async () => {
  let resolve!: (value: unknown) => void
  maps.lookup
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      }),
    )
    .mockResolvedValueOnce(result)
  render(<Form />)
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  fireEvent.change(screen.getByLabelText("Endereço"), {
    target: { value: "Rua Nova, 20" },
  })
  await act(async () => {
    resolve(result)
  })
  expect(screen.getByLabelText("Endereço")).toHaveValue("Rua Nova, 20")
  expect(screen.getByLabelText("Bairro de entrega")).toHaveValue("")
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  await waitFor(() =>
    expect(screen.getByLabelText("Bairro de entrega")).toHaveValue("center"),
  )
  expect(screen.getByLabelText("Cidade de entrega")).toHaveValue("São Paulo / SP")
  expect(screen.getByLabelText("Endereço")).toHaveValue("Praça da Sé")
})

it("does not overwrite a manually edited city with a pending lookup result", async () => {
  let resolve!: (value: unknown) => void
  maps.lookup.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r
    }),
  )
  render(<Form />)
  fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }))
  fireEvent.change(screen.getByLabelText("Cidade manual"), {
    target: { value: "Outra Cidade" },
  })
  await act(async () => resolve(result))
  expect(screen.getByLabelText("Cidade manual")).toHaveValue("Outra Cidade")
  expect(screen.getByLabelText("Bairro de entrega")).toHaveValue("")
})
