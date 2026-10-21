import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import LocationMap from "../src/shared/presentation/LocationMap"
const leaflet = vi.hoisted(() => {
  const mapInstance = {
    setView: vi.fn(),
    panTo: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 1, lng: 2 })),
  }
  mapInstance.setView.mockReturnValue(mapInstance)
  const marker = { setLatLng: vi.fn(), remove: vi.fn(), addTo: vi.fn() }
  marker.addTo.mockReturnValue(marker)
  const tiles = { addTo: vi.fn(), on: vi.fn() }
  tiles.addTo.mockReturnValue(tiles)
  return {
    map: vi.fn(() => mapInstance),
    circleMarker: vi.fn(() => marker),
    tileLayer: vi.fn(() => tiles),
    mapInstance,
    marker,
  }
})
vi.mock("leaflet", () => leaflet)
it("updates the point without recreating the map, keeps keyboard selection and releases the map on unmount", async () => {
  const onSelect = vi.fn()
  const view = render(
    <LocationMap latitude={0} longitude={0} onSelect={onSelect} selecting />,
  )
  fireEvent.click(screen.getByRole("button", { name: "Selecionar ponto no mapa" }))
  await waitFor(() => expect(leaflet.map).toHaveBeenCalledOnce())
  for (let i = 1; i <= 10; i++)
    view.rerender(
      <LocationMap latitude={i} longitude={i} onSelect={onSelect} selecting />,
    )
  expect(leaflet.map).toHaveBeenCalledOnce()
  expect(leaflet.mapInstance.remove).not.toHaveBeenCalled()
  expect(leaflet.marker.setLatLng).toHaveBeenLastCalledWith([10, 10])
  fireEvent.click(screen.getByRole("button", { name: "Usar centro do mapa" }))
  expect(onSelect).toHaveBeenCalledWith(1, 2)
  view.unmount()
  expect(leaflet.mapInstance.remove).toHaveBeenCalledOnce()
})
