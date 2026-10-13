import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import userEvent from "@testing-library/user-event"

import { describe, expect, it, vi } from "vitest"

import ServicesProvider, {
  type ApplicationServices,
} from "../src/app/presentation/ServicesProvider"

import MenuScope from "../src/app/presentation/MenuScope"

import { LoadMenu } from "../src/modules/catalog/application/load-menu"

import { demoDirectory } from "../src/modules/catalog/infrastructure/demo-directory"

import ProductForm from "../src/modules/catalog/presentation/ProductForm"

import { Failure } from "../src/shared/domain/failure"

import { testServices, sampleMenu } from "./helpers"

import type { Result } from "../src/shared/application/result"

import type { MenuDocument } from "../src/modules/catalog/application/menu-document"

function setup() {
  const dependencies = testServices()

  const services: ApplicationServices = {
    ...dependencies,

    menu: new LoadMenu(
      dependencies.repository,
      demoDirectory,
      dependencies.access,
      dependencies.executor,
    ),

    images: { read: async () => ({ ok: true, value: "" }) },

    checkAdmin: () => dependencies.executor.run("access", "admin", async () => {}),

    reportUnexpected: () =>
      dependencies.executor.run("ui", "render", async () => {
        throw new Error("render")
      }),
  }

  return { dependencies, services }
}

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value() {
    this.open = true
  },
})

Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value() {
    this.open = false
  },
})

describe("formulário de produto", () => {
  it("preserva campos e diálogo quando a gravação falha", async () => {
    const { dependencies, services } = setup()
    const onSaved = vi.fn()

    vi.spyOn(dependencies.repository, "commit").mockRejectedValue(
      new Failure("STORAGE_QUOTA", "Armazenamento cheio."),
    )

    render(
      <ServicesProvider services={services}>
        <MenuScope slug="burger-house">
          <ProductForm onClose={vi.fn()} onSaved={onSaved} />
        </MenuScope>
      </ServicesProvider>,
    )

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText("Nome do produto *"), "Meu hambúrguer")

    await user.type(screen.getByLabelText("Preço de venda *"), "28.90")
    await user.click(screen.getByRole("button", { name: "Salvar produto" }))

    expect(await screen.findByText("Armazenamento cheio.")).toBeInTheDocument()
    expect(screen.getByLabelText("Nome do produto *")).toHaveValue("Meu hambúrguer")

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("impede submissão dupla enquanto aguarda o repositório", async () => {
    const { dependencies, services } = setup()
    const original = dependencies.repository.commit.bind(dependencies.repository)

    let release: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const save = vi
      .spyOn(dependencies.repository, "commit")
      .mockImplementation(async (...args) => {
        await gate
        return original(...args)
      })

    render(
      <ServicesProvider services={services}>
        <MenuScope slug="burger-house">
          <ProductForm onClose={vi.fn()} onSaved={vi.fn()} />
        </MenuScope>
      </ServicesProvider>,
    )

    await screen.findByLabelText("Nome do produto *")
    fireEvent.change(screen.getByLabelText("Nome do produto *"), {
      target: { value: "Teste" },
    })

    fireEvent.change(screen.getByLabelText("Preço de venda *"), {
      target: { value: "28,90" },
    })

    const form = screen.getByRole("button", { name: "Salvar produto" }).closest("form")!

    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))

    await act(async () => {
      release()
      await gate
    })
  })
})

it("descarta resposta atrasada depois da mudança de restaurante", async () => {
  const { services } = setup()
  let resolveOld: (result: Result<MenuDocument>) => void

  const oldRequest = new Promise<Result<MenuDocument>>((resolve) => {
    resolveOld = resolve
  })

  vi.spyOn(services.menu, "execute").mockImplementation((slug) =>
    slug === "old"
      ? oldRequest
      : Promise.resolve({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Restaurante não encontrado.",
            fields: {},
            diagnosticId: "new",
          },
        }),
  )

  const { rerender } = render(
    <ServicesProvider services={services}>
      <MenuScope key="old" slug="old">
        <p>Conteúdo anterior</p>
      </MenuScope>
    </ServicesProvider>,
  )

  rerender(
    <ServicesProvider services={services}>
      <MenuScope key="new" slug="new">
        <p>Conteúdo novo</p>
      </MenuScope>
    </ServicesProvider>,
  )

  await screen.findByText("Restaurante não encontrado.")

  await act(async () => {
    resolveOld({ ok: true, value: sampleMenu() })
    await oldRequest
  })

  expect(screen.getByText("Restaurante não encontrado.")).toBeInTheDocument()
  expect(screen.queryByText("Conteúdo anterior")).not.toBeInTheDocument()
})
