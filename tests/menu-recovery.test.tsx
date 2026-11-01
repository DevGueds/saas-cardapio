import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { Result } from "@cardapio/contracts"
import type { MenuDocument } from "../src/modules/catalog/application/menu-document"
import MenuScope, { useMenu } from "../src/app/presentation/MenuScope"
import ServicesProvider, {
  type ApplicationServices,
} from "../src/app/presentation/ServicesProvider"
import { sampleMenu, testServices } from "./helpers"
import { defaultStoreHours } from "@cardapio/domain/store-hours"

afterEach(() => vi.useRealTimers())

function showMenu(execute: () => Promise<Result<MenuDocument>>, onRender = () => {}) {
  const dependencies = testServices()
  let saved: ((menu?: MenuDocument) => void) | undefined
  const services: ApplicationServices = {
    ...dependencies,
    menu: {
      execute,
      subscribe: (_id, listener) => {
        saved = listener
        return () => {
          saved = undefined
        }
      },
    },
    images: { read: async () => ({ ok: true, value: "" }) },
    checkAdmin: () => dependencies.executor.run("access", "admin", async () => {}),
    reportUnexpected: () =>
      dependencies.executor.run("ui", "render", async () => {
        throw new Error("render")
      }),
  }
  function Probe() {
    onRender()
    const { menu, refreshing, error, reload } = useMenu()
    return (
      <>
        <h1>{menu.restaurant.name}</h1>
        <span>{refreshing ? "Atualizando" : "Carregado"}</span>
        <span>{error ? "Dados anteriores" : "Dados confirmados"}</span>
        <button onClick={() => void reload()}>Recarregar teste</button>
      </>
    )
  }
  const view = render(
    <ServicesProvider services={services}>
      <MenuScope slug="burger-house">
        <Probe />
      </MenuScope>
    </ServicesProvider>,
  )
  return { ...view, saved: (menu: MenuDocument) => saved?.(menu) }
}

it("recovers an initial menu failure without a subscription and keeps the menu during revalidation", async () => {
  vi.useFakeTimers()
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  const menu = sampleMenu()
  let resolve!: (result: Result<MenuDocument>) => void
  const execute = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      error: {
        code: "STORAGE_UNAVAILABLE",
        message: "Conexão indisponível",
        diagnosticId: "test",
        fields: {},
      },
    })
    .mockResolvedValueOnce({ ok: true, value: menu })
    .mockImplementation(
      () =>
        new Promise<Result<MenuDocument>>((done) => {
          resolve = done
        }),
    )
  showMenu(execute)
  await act(async () => {})
  expect(screen.getByText("Conexão indisponível")).toBeInTheDocument()
  await act(async () => {
    online.mockReturnValue(true)
    window.dispatchEvent(new Event("online"))
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(250)
  })
  expect(screen.getByRole("heading", { name: menu.restaurant.name })).toBeInTheDocument()
  expect(execute).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole("button", { name: "Recarregar teste" }))
  fireEvent.click(screen.getByRole("button", { name: "Recarregar teste" }))
  expect(execute).toHaveBeenCalledTimes(3)
  expect(screen.getByText("Atualizando")).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: menu.restaurant.name })).toBeInTheDocument()
  await act(async () => {
    resolve({
      ok: true,
      value: { ...menu, restaurant: { ...menu.restaurant, name: "Loja atualizada" } },
    })
  })
  expect(screen.getByRole("heading", { name: "Loja atualizada" })).toBeInTheDocument()
})

it("does not rerender every consumer on schedule clock ticks while availability is unchanged", async () => {
  vi.useFakeTimers()
  const original = sampleMenu()
  const menu: MenuDocument = {
    ...original,
    restaurant: {
      ...original.restaurant,
      isOpen: true,
      hours: {
        ...defaultStoreHours(),
        enabled: true,
        weekly: Array.from({ length: 7 }, () => [
          { opensAt: "00:00", closesAt: "24:00" },
        ]),
      },
    },
  }
  const rendered = vi.fn()
  showMenu(async () => ({ ok: true, value: menu }), rendered)
  await act(async () => {})
  const before = rendered.mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(rendered).toHaveBeenCalledTimes(before)
})

it("preserves a confirmed write when an older pending menu read finishes", async () => {
  const menu = sampleMenu()
  let resolve!: (result: Result<MenuDocument>) => void
  const execute = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, value: menu })
    .mockImplementation(
      () =>
        new Promise<Result<MenuDocument>>((done) => {
          resolve = done
        }),
    )
  const view = showMenu(execute)
  await screen.findByRole("heading", { name: menu.restaurant.name })
  fireEvent.click(screen.getByRole("button", { name: "Recarregar teste" }))
  act(() =>
    view.saved({
      ...menu,
      revision: menu.revision + 1,
      restaurant: { ...menu.restaurant, name: "Nome salvo" },
    }),
  )
  expect(screen.getByRole("heading", { name: "Nome salvo" })).toBeInTheDocument()
  expect(screen.getByText("Carregado")).toBeInTheDocument()
  await act(async () => resolve({ ok: true, value: menu }))
  expect(screen.getByRole("heading", { name: "Nome salvo" })).toBeInTheDocument()
})
