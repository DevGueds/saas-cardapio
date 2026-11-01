import { currentLegalAcceptance } from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { expect, test, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"

async function rememberAccount(id: string) {
  // Reuse the existing cleanup allowlist, restricted to *_test and fixture emails.
  await mkdir(".cache", { recursive: true })
  const filename = ".cache/settings-browser-users.json"
  let users: string[] = []
  try {
    users = JSON.parse(await readFile(filename, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await writeFile(filename, JSON.stringify([...users, id]), "utf8")
}

async function createStore(page: Page, origin: string) {
  const slug = `network-${randomUUID().slice(0, 8)}`
  const account = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin },
      data: {
        legalAcceptance: currentLegalAcceptance,
        name: "Pessoa Rede",
        email: `${slug}@browser.example.test`,
        password: "M7!qR2@x",
        restaurantName: "Cozinha Conectada",
        slug,
      },
    })
  ).json()
  expect(account.ok, JSON.stringify(account.error)).toBe(true)
  await rememberAccount(account.value.user.id)
  const store = (await (await page.request.get("/api/v1/me/restaurants")).json()).value[0]
  const headers = { origin, "x-csrf-token": account.value.csrfToken }
  let menu: MenuDocument = (
    await (await page.request.get(`/api/v1/restaurants/${store.id}/menu`)).json()
  ).value
  async function mutate(path: string, data: object, method: "post" | "put" = "put") {
    const result = await (
      await page.request[method](`/api/v1/restaurants/${store.id}${path}`, {
        headers,
        data: { expectedRevision: menu.revision, ...data },
      })
    ).json()
    expect(result.ok, JSON.stringify(result.error)).toBe(true)
    menu = result.value
  }
  await mutate(
    "/products",
    {
      name: "Lanche da casa",
      description: "Preparado na hora.",
      price: "20,00",
      categoryId: "",
      newCategoryName: "Lanches",
      imageUrl: "",
      available: true,
      popular: false,
    },
    "post",
  )
  await mutate("/delivery", {
    delivery: {
      enabled: false,
      pickupEnabled: true,
      mode: "FLAT",
      pickupEta: "20–30 min",
      zones: [],
    },
  })
  await mutate("/open", { isOpen: true })
  return {
    slug,
    storeId: store.id as string,
    menuPath: `/api/v1/public/restaurants/${slug}/menu`,
    ordersPath: `/api/v1/public/restaurants/${slug}/orders`,
    async renameProduct() {
      const product = menu.products[0]!
      await mutate(`/products/${product.id}`, {
        name: "Lanche da casa atualizado",
        description: product.description,
        price: "20,00",
        categoryId: product.categoryId,
        imageUrl: product.imageUrl,
        available: true,
        popular: false,
      })
    },
  }
}

async function openCheckout(page: Page) {
  const consent = page.getByRole("button", { name: "Entendi", exact: true })
  if (await consent.isVisible()) await consent.click()
  await page
    .getByRole("button", { name: "Adicionar Lanche da casa", exact: true })
    .click()
  await page.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
  await page.getByRole("radio", { name: /Retirada/ }).check()
  await page.getByLabel("Seu nome completo *", { exact: true }).fill("Cliente da Rede")
  await page.getByLabel("Seu WhatsApp com DDD *", { exact: true }).fill("11999999999")
  await page
    .getByLabel("Observações para retirada", { exact: true })
    .fill("Sem guardanapos")
  await expect(page.locator(".order-summary__total")).toContainText("20,00")
}

test("a slow menu read recovers from two HTML gateway responses without corrupt-data errors", async ({
  page,
  baseURL,
}) => {
  const fixture = await createStore(page, baseURL!)
  let attempts = 0
  const corruptErrors: string[] = []
  page.on("console", (message) => {
    if (message.text().includes("CORRUPT_DATA")) corruptErrors.push(message.text())
  })
  await page.route(`**${fixture.menuPath}`, async (route) => {
    attempts++
    if (attempts <= 2) {
      await route.fulfill({
        status: 503,
        contentType: "text/html",
        headers: { "retry-after": "0" },
        body: "<html><body>Service temporarily unavailable</body></html>",
      })
      return
    }
    // A bounded delayed response exercises the pending state without slowing
    // unrelated Vite module requests or using arbitrary assertion sleeps.
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await route.fulfill({ response })
  })
  await page.goto(`/menu/${fixture.slug}`)
  await expect(
    page.getByRole("heading", { name: "Lanche da casa", exact: true }),
  ).toBeVisible()
  expect(attempts).toBe(3)
  expect(corruptErrors).toEqual([])
  await expect(
    page.getByText("A resposta da API não pôde ser validada.", { exact: false }),
  ).toHaveCount(0)
  await expect(page.locator(".state-page .error-notice")).toHaveCount(0)
})

for (const viewport of [
  { width: 390, height: 844, label: "mobile" },
  { width: 1440, height: 1000, label: "desktop" },
]) {
  test(`offline browsing preserves cart and customer fields and reconnects automatically on ${viewport.label}`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const fixture = await createStore(page, baseURL!)
    const context = await browser.newContext({
      baseURL,
      viewport,
      isMobile: viewport.label === "mobile",
      hasTouch: viewport.label === "mobile",
    })
    const customer = await context.newPage()
    let reads = 0
    await context.route(`**${fixture.menuPath}`, async (route) => {
      reads++
      await route.fallback()
    })
    try {
      await customer.goto(`/menu/${fixture.slug}`)
      await openCheckout(customer)
      await customer
        .getByRole("dialog", { name: "Seu carrinho" })
        .getByRole("button", { name: "Fechar", exact: true })
        .click()
      const readsBeforeOffline = reads
      await context.setOffline(true)
      await expect(
        customer.getByRole("status").filter({ hasText: "Sem conexão com a internet" }),
      ).toBeVisible()
      await expect(
        customer.getByRole("heading", { name: "Lanche da casa", exact: true }),
      ).toBeVisible()
      await expect(
        customer.getByRole("button", { name: "Abrir carrinho com 1 item" }),
      ).toBeVisible()
      expect(
        await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true)
      await customer.screenshot({
        path: `.cache/network-${viewport.label}-offline.png`,
        fullPage: true,
      })
      await customer.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
      await expect(
        customer.getByLabel("Seu nome completo *", { exact: true }),
      ).toHaveValue("Cliente da Rede")
      await expect(
        customer.getByLabel("Seu WhatsApp com DDD *", { exact: true }),
      ).toHaveValue(/99999/)
      await expect(
        customer.getByLabel("Observações para retirada", { exact: true }),
      ).toHaveValue("Sem guardanapos")
      await customer
        .getByRole("dialog", { name: "Seu carrinho" })
        .getByRole("button", { name: "Fechar", exact: true })
        .click()
      // Another connection can update the store while the customer is offline.
      await fixture.renameProduct()
      await context.setOffline(false)
      await expect.poll(() => reads).toBeGreaterThan(readsBeforeOffline)
      await expect(
        customer.getByRole("heading", { name: "Lanche da casa atualizado", exact: true }),
      ).toBeVisible()
      await expect(
        customer.getByRole("status").filter({ hasText: "Sem conexão com a internet" }),
      ).toHaveCount(0)
      await customer.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
      await expect(
        customer.getByLabel("Seu nome completo *", { exact: true }),
      ).toHaveValue("Cliente da Rede")
      await expect(
        customer.getByLabel("Observações para retirada", { exact: true }),
      ).toHaveValue("Sem guardanapos")
      await expect(customer.getByRole("radio", { name: /Retirada/ })).toBeChecked()
      // Disk-backed drafts still survive a normal reload after recovery.
      await customer.reload()
      await expect(
        customer.getByLabel("Seu nome completo *", { exact: true }),
      ).toHaveValue("Cliente da Rede")
      await expect(
        customer.getByLabel("Observações para retirada", { exact: true }),
      ).toHaveValue("Sem guardanapos")
      await customer.screenshot({
        path: `.cache/network-${viewport.label}-recovered.png`,
        fullPage: true,
      })
    } finally {
      await context.close()
    }
  })
}

test("a lost checkout response retries the same persisted order instead of creating another", async ({
  page,
  browser,
  baseURL,
}) => {
  const fixture = await createStore(page, baseURL!)
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const customer = await context.newPage()
  const requests: Array<{ key: string | undefined; body: string | null }> = []
  const orderIds: string[] = []
  try {
    await customer.goto(`/menu/${fixture.slug}`)
    await openCheckout(customer)
    await customer.route(`**${fixture.ordersPath}`, async (route) => {
      requests.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      })
      const response = await route.fetch()
      const result = await response.json()
      expect(result.ok, JSON.stringify(result.error)).toBe(true)
      orderIds.push(result.value.orderId)
      // The database committed before the first response disappeared.
      if (requests.length === 1) await route.abort("connectionreset")
      else await route.fulfill({ response })
    })
    await customer
      .getByRole("button", { name: "Enviar pedido para a loja", exact: true })
      .click()
    await expect(
      customer.getByRole("heading", { name: "Pedido enviado para a loja!", exact: true }),
    ).toBeVisible()
    expect(requests).toHaveLength(2)
    expect(requests[0]!.key).toMatch(/^[a-f0-9-]{36}$/i)
    expect(requests[1]).toEqual(requests[0])
    expect(new Set(orderIds).size).toBe(1)
    const persisted = await (
      await page.request.get(`/api/v1/restaurants/${fixture.storeId}/orders`)
    ).json()
    expect(persisted.ok, JSON.stringify(persisted.error)).toBe(true)
    expect(persisted.value.items).toHaveLength(1)
    expect(persisted.value.items[0]).toMatchObject({ id: orderIds[0], total: 2000 })
    await customer
      .getByRole("button", { name: "Voltar ao cardápio", exact: true })
      .click()
    await expect(
      customer.getByRole("button", { name: "Abrir carrinho com 0 itens" }),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})
