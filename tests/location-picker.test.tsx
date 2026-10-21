import { useState } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import type { GeoPoint } from "@cardapio/domain/delivery-radius"
import LocationPicker from "../src/app/presentation/LocationPicker"
const location = vi.hoisted(() => ({ unsupported: vi.fn(() => null), locate: vi.fn() }))
vi.mock("../src/app/presentation/ServicesProvider", () => ({
  useServices: () => ({ deviceLocation: location }),
}))
vi.mock("../src/app/presentation/ReferenceMap", () => ({
  default: () => <div>Mapa</div>,
}))
function Picker() {
  const [point, setPoint] = useState<GeoPoint | null>(null)
  return (
    <>
      <LocationPicker title="Ponto" value={point} onChange={setPoint} />
      <output aria-label="Confirmado">{JSON.stringify(point)}</output>
    </>
  )
}
it("does not let a delayed GPS response replace a manually edited point and accepts decimal commas", async () => {
  let resolve!: (value: unknown) => void
  location.locate.mockReturnValue(
    new Promise((r) => {
      resolve = r
    }),
  )
  render(<Picker />)
  fireEvent.click(screen.getByRole("button", { name: "Usar minha localização" }))
  fireEvent.click(screen.getByText("Informar coordenadas"))
  fireEvent.change(screen.getByLabelText("Latitude do ponto"), {
    target: { value: "-23,55" },
  })
  fireEvent.change(screen.getByLabelText("Longitude do ponto"), {
    target: { value: "-46,63" },
  })
  await act(async () => {
    resolve({ ok: true, value: { latitude: 10, longitude: 20, accuracy: 5 } })
  })
  fireEvent.click(screen.getByRole("button", { name: "Confirmar ponto do endereço" }))
  expect(screen.getByLabelText("Confirmado")).toHaveTextContent(
    '{"latitude":-23.55,"longitude":-46.63}',
  )
  fireEvent.change(screen.getByLabelText("Longitude do ponto"), {
    target: { value: "-46,64" },
  })
  expect(screen.getByLabelText("Confirmado")).toHaveTextContent("null")
})
