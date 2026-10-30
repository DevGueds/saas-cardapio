import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { currentLegalAcceptance, type OrderView } from "@cardapio/contracts"
import { verifyFixtureEmail } from "./verified-fixture"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { localClock } from "@cardapio/domain/store-hours"
import { sampleAddress } from "../address-fixture"

test("filters, sales analytics and automatic hours work with real orders on mobile", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000)
  const suffix = randomUUID().slice(0, 8),
    slug = `desempenho-${suffix}`
  const registered = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        name: "Gestora Desempenho",
        email: `analytics-${suffix}@browser.example.test`,
        password: "M7!qR2@x",
        restaurantName: "Cozinha do Bairro",
        slug,
        legalAcceptance: currentLegalAcceptance,
      },
    })
  ).json()
  expect(registered.ok, registered.error?.message).toBe(true)
  const stores = await (await page.request.get("/api/v1/me/restaurants")).json(),
    store = stores.value[0]
  const headers = { origin: baseURL!, "x-csrf-token": registered.value.csrfToken },
    route = `/api/v1/restaurants/${store.id}`
  const courierContext = await browser.newContext({ baseURL }),
    courierEmail = `analytics-courier-${suffix}@browser.example.test`
  const courier = await (
    await courierContext.request.post("/api/v1/auth/register-account", {
      headers: { origin: baseURL! },
      data: {
        name: "Entregador Teste",
        email: courierEmail,
        password: "M7!qR2@x",
        legalAcceptance: currentLegalAcceptance,
      },
    })
  ).json()
  expect(courier.ok).toBe(true)
  await verifyFixtureEmail(courierEmail)
  await courierContext.close()
  await mkdir(".cache", { recursive: true })
  let known: string[] = []
  try {
    known = JSON.parse(await readFile(".cache/analytics-browser-users.json", "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await writeFile(
    ".cache/analytics-browser-users.json",
    JSON.stringify([...known, registered.value.user.id, courier.value.user.id]),
  )
  expect(
    (
      await page.request.post(`/api/v1/tenants/${store.tenantId}/members`, {
        headers,
        data: { email: courierEmail, role: "COURIER" },
      })
    ).status(),
  ).toBe(201)
  const current = async (): Promise<MenuDocument> =>
    (await (await page.request.get(route + "/menu")).json()).value
  let menu = await current()
  for (const [name, price] of [
    ["Pizza Mais Vendida", "10,00"],
    ["Suco de Laranja", "5,00"],
    ["Pizza Especial", "20,00"],
  ]) {
    const result = await (
      await page.request.post(route + "/products", {
        headers,
        data: {
          expectedRevision: menu.revision,
          name,
          price,
          description: "Preparado na hora.",
          categoryId: menu.categories[0]?.id ?? "",
          ...(menu.categories.length ? {} : { newCategoryName: "Cardápio" }),
          imageUrl: "",
          available: true,
          popular: false,
        },
      })
    ).json()
    expect(result.ok, result.error?.message).toBe(true)
    menu = result.value
  }
  menu = (
    await (
      await page.request.put(route + "/open", {
        headers,
        data: { expectedRevision: menu.revision, isOpen: true },
      })
    ).json()
  ).value
  for (const [name, quantity] of [
    ["Pizza Mais Vendida", 2],
    ["Suco de Laranja", 1],
  ] as const) {
    const product = menu.products.find((p) => p.name === name)!
    const created = await (
      await page.request.post(`/api/v1/public/restaurants/${slug}/orders`, {
        headers: { origin: baseURL!, "idempotency-key": randomUUID() },
        data: {
          expectedRevision: menu.revision,
          cart: {
            restaurantId: store.id,
            lines: [
              { productId: product.id, quantity, unitPrice: product.price, note: "" },
            ],
          },
          details: {
            name: "Cliente Frequente",
            phone: "11999990001",
            address: "Rua São João, 10",
            deliveryAddress: sampleAddress(),
            notes: "",
            payment: "Pix",
            cashChange: "",
          },
        },
      })
    ).json()
    expect(created.ok, created.error?.message).toBe(true)
    const list = await (await page.request.get(route + "/orders")).json()
    let order: OrderView = list.value.items.find(
      (o: OrderView) => o.id === created.value.orderId,
    )
    for (const status of ["PREPARING", "READY"]) {
      const changed = await (
        await page.request.put(`${route}/orders/${order.id}/status`, {
          headers,
          data: { expectedRevision: order.revision, status },
        })
      ).json()
      expect(changed.ok, changed.error?.message).toBe(true)
      order = changed.value
    }
    const assigned = await (
      await page.request.put(`${route}/orders/${order.id}/courier`, {
        headers,
        data: { expectedRevision: order.revision, courierId: courier.value.user.id },
      })
    ).json()
    expect(assigned.ok).toBe(true)
    order = assigned.value
    for (const status of ["OUT_FOR_DELIVERY", "COMPLETED"]) {
      const changed = await (
        await page.request.put(`${route}/orders/${order.id}/status`, {
          headers,
          data: { expectedRevision: order.revision, status },
        })
      ).json()
      expect(changed.ok, changed.error?.message).toBe(true)
      order = changed.value
    }
  }
  await page.goto(`/admin/analytics?restaurant=${store.id}`)
  await expect(
    page.getByRole("heading", { name: "Dashboard de desempenho", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Entendi", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Clientes que mais compram", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Cliente Frequente", { exact: true })).toBeVisible()
  await expect(page.getByText("Entregador Teste", { exact: false })).toBeVisible()
  await expect(page.locator("body")).not.toContainText("5511999990001")
  for (const label of ["Dia", "Semana", "Mês", "Ano"]) {
    await page.getByRole("button", { name: label, exact: true }).click()
    await expect(
      page.getByRole("status").filter({ hasText: "Consultando os dados" }),
    ).toHaveCount(0)
    await expect(page.getByText("Cliente Frequente", { exact: true })).toBeVisible()
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: ".cache/analytics-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 320, height: 900 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/analytics-mobile.png", fullPage: true })
  const customerContext = await browser.newContext({
      baseURL,
      viewport: { width: 320, height: 900 },
    }),
    customer = await customerContext.newPage()
  await customer.goto(`/menu/${slug}`)
  await customer.getByRole("button", { name: "Entendi", exact: true }).click()
  const best = customer.getByRole("button", { name: "Mais vendidos", exact: true })
  await best.click()
  await expect(best).toHaveAttribute("aria-pressed", "true")
  await expect(customer.locator(".product-grid .product-card h3")).toHaveText([
    "Pizza Mais Vendida",
    "Suco de Laranja",
  ])
  await customer.getByRole("button", { name: "Menores preços", exact: true }).click()
  await expect(customer.locator(".product-grid .product-card h3")).toHaveText([
    "Suco de Laranja",
    "Pizza Mais Vendida",
    "Pizza Especial",
  ])
  await customer.getByRole("button", { name: "Promoções", exact: true }).click()
  await expect(
    customer.getByRole("heading", {
      name: "Nenhuma promoção ativa no momento",
      exact: true,
    }),
  ).toBeVisible()
  menu = await current()
  const offer = await (
    await page.request.put(route + "/promotions", {
      headers,
      data: {
        expectedRevision: menu.revision,
        promotion: {
          id: randomUUID(),
          name: "Oferta do Bairro",
          code: "BAIRRO10",
          kind: "PERCENT",
          value: 10,
          minSubtotal: 0,
          maxDiscount: 0,
          includeCombos: false,
          active: true,
          startsAt: new Date(Date.now() - 60000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
          maxUses: 0,
        },
      },
    })
  ).json()
  expect(offer.ok, offer.error?.message).toBe(true)
  await customer.reload()
  await customer.getByRole("button", { name: "Promoções", exact: true }).click()
  await expect(customer.getByText("Oferta do Bairro", { exact: true })).toBeVisible()
  await expect(customer.locator(".product-grid .product-card")).toHaveCount(3)
  expect(
    await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await customer.screenshot({ path: ".cache/menu-filters-mobile.png", fullPage: true })
  await page.goto(`/admin/hours?restaurant=${store.id}`)
  await expect(
    page.getByRole("heading", { name: "Horários da loja", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("checkbox", { name: "Ativar horários automáticos", exact: true })
    .check()
  await page
    .getByRole("button", { name: "Adicionar horário", exact: true })
    .first()
    .click()
  await page.getByLabel("Abertura Segunda-feira, faixa 1", { exact: true }).fill("18:00")
  await page
    .getByLabel("Fechamento Segunda-feira, faixa 1", { exact: true })
    .fill("02:00")
  await expect(page.getByText("Fecha no dia seguinte", { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.reload()
  await expect(
    page.getByLabel("Fechamento Segunda-feira, faixa 1", { exact: true }),
  ).toHaveValue("02:00")
  await page
    .getByRole("button", { name: "Remover faixa 1 de Segunda-feira", exact: true })
    .click()
  await page.getByRole("button", { name: "24 horas", exact: true }).first().click()
  await page
    .getByRole("button", { name: "Repetir na semana inteira", exact: true })
    .click()
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/hours") && response.request().method() === "PUT",
  )
  await page.getByRole("button", { name: "Salvar programação", exact: true }).click()
  expect((await (await saved).json()).ok).toBe(true)
  await expect(
    page.getByRole("switch", { name: "Loja aberta", exact: true }),
  ).toBeChecked()
  const today = localClock(Date.now(), "America/Sao_Paulo").date,
    formatted = today.split("-").reverse().join("/")
  await page
    .getByRole("button", { name: `Editar horário de ${formatted}`, exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Horário especial", exact: true })
  await dialog.getByLabel("Nome da exceção", { exact: true }).fill("Feriado da loja")
  await dialog
    .getByRole("checkbox", { name: "Repetir todos os anos neste dia e mês", exact: true })
    .check()
  await expect(
    dialog.getByRole("checkbox", { name: "Loja fechada nesta data", exact: true }),
  ).toBeChecked()
  await dialog
    .getByRole("button", { name: "Adicionar à programação", exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  const closed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/hours") && response.request().method() === "PUT",
  )
  await page.getByRole("button", { name: "Salvar programação", exact: true }).click()
  expect((await (await closed).json()).value.restaurant.isOpen).toBe(false)
  await customer.reload()
  await expect(
    customer.getByText("Loja fechada no momento", { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await expect(page.locator(".Toastify__toast")).toHaveCount(0, { timeout: 10000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: ".cache/store-hours-mobile.png", fullPage: true })
  await page.getByRole("switch", { name: "Loja aberta", exact: true }).click()
  await expect(page.getByText(/Controle manual até/)).toBeVisible()
  await page.getByRole("button", { name: "Voltar à programação", exact: true }).click()
  await expect(
    page.getByRole("switch", { name: "Loja aberta", exact: true }),
  ).not.toBeChecked()
  await customerContext.close()
})
