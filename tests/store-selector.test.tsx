import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { expect, it, vi } from "vitest"
import type { RestaurantAccess, SessionView } from "@cardapio/contracts"
import StoreSelector from "../src/modules/identity/presentation/StoreSelector"

const session: SessionView = {
  user: { id: "person", name: "Ana da Silva" },
  csrfToken: "",
  expiresAt: "2027-01-01T00:00:00Z",
}
const store = (
  name: string,
  id: string,
  role: RestaurantAccess["role"] = "OWNER",
): RestaurantAccess => ({ id, tenantId: "tenant", name, slug: `loja-${id}`, role })
function setup(stores: RestaurantAccess[] = [], onRefresh = vi.fn(async () => {})) {
  const onCreate = vi.fn(),
    onLogout = vi.fn()
  const props = { session, error: null, signingOut: false, onCreate, onLogout, onRefresh }
  const view = render(
    <MemoryRouter>
      <StoreSelector
        session={session}
        stores={stores}
        error={null}
        signingOut={false}
        onCreate={onCreate}
        onLogout={onLogout}
        onRefresh={onRefresh}
      />
    </MemoryRouter>,
  )
  return {
    user: userEvent.setup(),
    onCreate,
    onLogout,
    onRefresh,
    updateStores(next: RestaurantAccess[]) {
      view.rerender(
        <MemoryRouter>
          <StoreSelector {...props} stores={next} />
        </MemoryRouter>,
      )
    },
  }
}
it("explains an empty account while keeping create, profile, refresh and logout available", async () => {
  const { user, onCreate, onLogout, onRefresh } = setup()
  expect(
    screen.getByRole("heading", { name: "Sua primeira loja começa aqui" }),
  ).toBeVisible()
  expect(screen.getByRole("link", { name: "Meu perfil e contato" })).toHaveAttribute(
    "href",
    "/minha-conta",
  )
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Criar nova loja" }))
  expect(onCreate).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "Atualizar meus acessos" }))
  expect(onRefresh).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "Sair da conta" }))
  expect(onLogout).toHaveBeenCalledOnce()
})
it("keeps each store and its permission-specific destination distinct", () => {
  setup([store("Café da Ana", "cafe"), store("Cozinha Central", "central", "KITCHEN")])
  expect(screen.getByText("2 lojas na sua conta")).toBeVisible()
  expect(screen.getByRole("link", { name: /Café da Ana/ })).toHaveAttribute(
    "href",
    "/admin/menu?restaurant=cafe",
  )
  expect(screen.getByRole("link", { name: /Cozinha Central/ })).toHaveAttribute(
    "href",
    "/admin/orders?restaurant=central",
  )
})
it("finds stores without requiring accents and recovers from an empty search", async () => {
  const { user } = setup([
    store("Café da Praça", "praca"),
    ...Array.from({ length: 4 }, (_, index) => store(`Loja ${index}`, String(index))),
  ])
  const search = screen.getByRole("searchbox")
  await user.type(search, "CAFE")
  expect(screen.getByRole("link", { name: /Café da Praça/ })).toBeVisible()
  expect(screen.queryByRole("link", { name: /Loja 0/ })).not.toBeInTheDocument()
  await user.clear(search)
  await user.type(search, "não existe")
  expect(screen.getByRole("heading", { name: "Nenhuma loja encontrada" })).toBeVisible()
  await user.click(screen.getByRole("button", { name: "Limpar busca" }))
  expect(search).toHaveValue("")
  expect(screen.getByRole("link", { name: /Loja 0/ })).toBeVisible()
})
it("prevents repeated refreshes while the current request is pending", async () => {
  let finish!: () => void
  const onRefresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const { user } = setup([], onRefresh)
  await user.click(screen.getByRole("button", { name: "Atualizar meus acessos" }))
  expect(screen.getByRole("button", { name: "Atualizando acessos…" })).toBeDisabled()
  expect(onRefresh).toHaveBeenCalledOnce()
  finish()
  expect(
    await screen.findByRole("button", { name: "Atualizar meus acessos" }),
  ).toBeEnabled()
})
it("keeps an active search editable when refreshing reduces the store count", async () => {
  const cafe = store("Café da Praça", "cafe")
  const { user, updateStores } = setup([
    cafe,
    ...Array.from({ length: 4 }, (_, index) => store(`Loja ${index}`, String(index))),
  ])
  await user.type(screen.getByRole("searchbox"), "cafe")
  updateStores([cafe, store("Outra loja", "outra")])
  expect(screen.getByRole("searchbox")).toHaveValue("cafe")
  await user.clear(screen.getByRole("searchbox"))
  expect(screen.getByRole("link", { name: /Outra loja/ })).toBeVisible()
})
