import { sampleAddress } from "./address-fixture"
import { describe, expect, it, vi } from "vitest"

import { Failure } from "../src/shared/domain/failure"

import { LoadMenu } from "../src/modules/catalog/application/load-menu"

import { demoDirectory } from "../src/modules/catalog/infrastructure/demo-directory"

import type { SaveProductInput } from "../src/modules/catalog/application/catalog-commands"

import type { Cart } from "../src/modules/checkout/domain/cart"

import type { DeliveryDetails } from "../src/modules/checkout/domain/order-message"

import { sampleMenu, testServices } from "./helpers"

const newProduct: SaveProductInput = {
  restaurantId: "demo-store",
  expectedRevision: 0,

  name: "Produto novo",
  description: "",
  price: "28.90",
  imageUrl: "",
  categoryId: "burgers",
  available: true,
  popular: false,
}

const cart: Cart = {
  restaurantId: "demo-store",
  lines: [{ productId: "prod-1", quantity: 1, unitPrice: 2800, note: "Sem cebola" }],
}

const customer: DeliveryDetails = {
  name: "Cliente Teste",
  phone: "11999998888",
  address: "Rua de Teste, 1",
  deliveryAddress: sampleAddress(),
  notes: "",
  payment: "Pix",
  cashChange: "",
}

describe("catálogo", () => {
  it("cria categoria e produto juntos, com IDs independentes do nome e valores em centavos", async () => {
    const services = testServices()
    const result = await services.catalog.save({
      ...newProduct,
      newCategoryName: "Novidades",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const product = result.value.products[0]
    expect(product.price).toBe(2890)

    expect(product.id).not.toBe("Produto novo")
    expect(
      result.value.categories.find((category) => category.id === product.categoryId)
        ?.name,
    ).toBe("Novidades")

    expect(result.value.revision).toBe(1)
  })

  it("rejeita categorias duplicadas normalizando espa?os, acentos e maiúsculas", async () => {
    const services = testServices()

    expect(
      await services.catalog.save({
        ...newProduct,
        newCategoryName: " HAMBURGUERES ",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })

    expect((await services.repository.load("demo-store")).revision).toBe(0)
  })

  it("preserva remoção de imagem na edição", async () => {
    const services = testServices()
    const result = await services.catalog.save({
      ...newProduct,
      id: "prod-1",
      imageUrl: "",
    })

    expect(
      result.ok &&
        result.value.products.find((product) => product.id === "prod-1")?.imageUrl,
    ).toBe("")
  })

  it("não recria produto removido por outra aba", async () => {
    const services = testServices()
    await services.catalog.delete("demo-store", 0, "prod-1")

    expect(await services.catalog.save({ ...newProduct, id: "prod-1" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    })
  })

  it("exige categoria do mesmo restaurante", async () => {
    const services = testServices()
    expect(
      await services.catalog.save({ ...newProduct, categoryId: "missing" }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it("retorna falha, sem sucesso, se o repositório recusa a operação", async () => {
    const services = testServices()
    vi.spyOn(services.repository, "commit").mockRejectedValue(
      new Failure("STORAGE_QUOTA", "Armazenamento cheio."),
    )

    expect(await services.catalog.save(newProduct)).toMatchObject({
      ok: false,
      error: { code: "STORAGE_QUOTA", diagnosticId: expect.any(String) },
    })

    expect((await services.repository.load("demo-store")).products).toHaveLength(13)
  })

  it.each(["production", "invalid", "", undefined])(
    "bloqueia administração no modo %s",
    async (mode) => {
      const services = testServices()

      // Explicit construction also covers undefined (without a default argument substituting demo).

      const { DemoAccessPolicy } =
        await import("../src/shared/infrastructure/browser-services")

      const { CatalogCommands } =
        await import("../src/modules/catalog/application/catalog-commands")

      const commands = new CatalogCommands(
        services.repository,
        new DemoAccessPolicy(mode),
        services.ids,
        services.executor,
      )

      expect(await commands.save(newProduct)).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      })

      expect(await commands.delete("demo-store", 0, "prod-1")).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      })

      expect(
        await commands.setAvailability("demo-store", 0, "prod-1", false),
      ).toMatchObject({ ok: false, error: { code: "ACCESS_DENIED" } })
    },
  )

  it("isola persistência entre restaurantes", async () => {
    const services = testServices([sampleMenu(), sampleMenu("second-store")])

    await services.catalog.delete("demo-store", 0, "prod-1")

    expect((await services.repository.load("second-store")).products).toHaveLength(13)
  })
})

describe("restaurante", () => {
  it("habilita o destino somente por configura??o explícita e converte taxas", async () => {
    const initial = sampleMenu()
    const services = testServices([
      {
        ...initial,
        restaurant: { ...initial.restaurant, whatsappConfigured: false },
      },
    ])

    const result = await services.restaurant.update("demo-store", 0, {
      ...initial.restaurant,
      whatsapp: "(55) 99999-8888",
      minOrder: "25,00",
      deliveryFee: "5,90",
    })

    expect(result.ok && result.value.restaurant).toMatchObject({
      whatsapp: "5555999998888",
      whatsappConfigured: true,
      deliveryFee: 590,
    })
  })

  it("rejeita slug desconhecido sem carregar a loja padrão", async () => {
    const services = testServices()
    const read = vi.spyOn(services.repository, "load")

    const loader = new LoadMenu(
      services.repository,
      demoDirectory,
      services.access,
      services.executor,
    )

    expect(await loader.execute("missing-store")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    })
    expect(read).not.toHaveBeenCalled()
  })

  it("bloqueia alteração de configurações e status fora da demo", async () => {
    const services = testServices([sampleMenu()], "production")

    expect(await services.restaurant.setOpen("demo-store", 0, false)).toMatchObject({
      ok: false,
      error: { code: "ACCESS_DENIED" },
    })

    expect(
      await services.restaurant.update("demo-store", 0, {
        ...sampleMenu().restaurant,
        minOrder: "0",
        deliveryFee: "0",
      }),
    ).toMatchObject({ ok: false, error: { code: "ACCESS_DENIED" } })
  })
})

describe("checkout", () => {
  it("prepara mensagem e link sem confirmar um pedido ou iniciar rede", async () => {
    const services = testServices()
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await services.checkout.execute("demo-store", 0, cart, customer)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const url = new URL(result.value.url)
    expect(url.origin).toBe("https://wa.me")
    expect(url.pathname).toBe("/5511999998888")

    expect(url.searchParams.get("text")).toContain("TOTAL: R$\u00a033,00")
    expect(url.searchParams.get("text")).toContain("Sem cebola")

    expect(fetchSpy).not.toHaveBeenCalled()
    expect((await services.repository.load("demo-store")).revision).toBe(0)
  })

  it.each([
    ["loja fechada", { isOpen: false }],
    ["WhatsApp não configurado", { whatsappConfigured: false }],
    ["pedido mínimo", { minOrder: 5000 }],
  ])("bloqueia %s", async (_description, patch) => {
    const menu = sampleMenu()
    const services = testServices([
      { ...menu, restaurant: { ...menu.restaurant, ...patch } },
    ])

    expect(
      await services.checkout.execute("demo-store", 0, cart, customer),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it("bloqueia carrinho vazio", async () =>
    expect(
      await testServices().checkout.execute(
        "demo-store",
        0,
        { restaurantId: "demo-store", lines: [] },
        customer,
      ),
    ).toMatchObject({ ok: false }))

  it("bloqueia item removido e preço desatualizado", async () => {
    const services = testServices()

    expect(
      await services.checkout.execute(
        "demo-store",
        0,
        { ...cart, lines: [{ ...cart.lines[0], productId: "removed" }] },
        customer,
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } })

    expect(
      await services.checkout.execute(
        "demo-store",
        0,
        { ...cart, lines: [{ ...cart.lines[0], unitPrice: 2700 }] },
        customer,
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } })
  })

  it("revalida produto esgotado e revisão atual", async () => {
    const services = testServices()
    await services.catalog.setAvailability("demo-store", 0, "prod-1", false)

    expect(
      await services.checkout.execute("demo-store", 0, cart, customer),
    ).toMatchObject({ ok: false, error: { code: "CONFLICT" } })

    expect(
      await services.checkout.execute("demo-store", 1, cart, customer),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it.each([
    { phone: "1" },
    { name: "" },
    { deliveryAddress: undefined },
    { payment: "Dinheiro" as const, cashChange: "10,00" },
    { payment: "Dinheiro" as const, cashChange: "Infinity" },
  ])("valida dados de entrega e troco %j", async (patch) => {
    expect(
      await testServices().checkout.execute("demo-store", 0, cart, {
        ...customer,
        ...patch,
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })

  it("aceita troco igual ao total", async () =>
    expect(
      await testServices().checkout.execute("demo-store", 0, cart, {
        ...customer,
        payment: "Dinheiro",
        cashChange: "33",
      }),
    ).toMatchObject({ ok: true }))
})

describe("diagnóstico", () => {
  it("registra metadados sem dados pessoais nem mensagem original da exceção", async () => {
    const services = testServices()

    const result = await services.executor.run("checkout", "privacy-test", async () => {
      throw new Error(
        "Cliente Teste 11999998888 Rua de Teste data:image/png;base64,PRIVATE",
      )
    })

    expect(result).toMatchObject({ ok: false, error: { code: "UNEXPECTED" } })

    expect(services.events[0]).toMatchObject({
      module: "checkout",
      operation: "privacy-test",
      diagnosticId: expect.any(String),
      cause: "unexpected_exception",
    })

    const logs = JSON.stringify(services.events)
    expect(logs).not.toMatch(/Cliente Teste|11999998888|Rua de Teste|PRIVATE/)
  })
})
