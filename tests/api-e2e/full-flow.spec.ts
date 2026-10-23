import { fillDeliveryAddress } from "../browser-address"
import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import jsQR from "jsqr"
import { PNG } from "pngjs"
const users: string[] = []
test("frete por raio sincroniza ponto, endereço, faixas e total em HTTP local", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000)
  const slug = `raio-${randomUUID().slice(0, 8)}`
  const registration = await page.request.post("/api/v1/auth/register", {
    headers: { origin: baseURL! },
    data: {
      name: "Gestor Raio",
      email: `${slug}@browser.example.test`,
      password: "12345678",
      restaurantName: "Loja por Raio",
      slug,
    },
  })
  const account = await registration.json()
  expect(account.ok).toBe(true)
  users.push(account.value.user.id)
  const stores = await (await page.request.get("/api/v1/me/restaurants")).json(),
    store = stores.value[0],
    headers = { origin: baseURL!, "x-csrf-token": account.value.csrfToken }
  const product = await (
    await page.request.post(`/api/v1/restaurants/${store.id}/products`, {
      headers,
      data: {
        expectedRevision: 0,
        name: "Lanche raio",
        description: "",
        price: "10,01",
        categoryId: "",
        newCategoryName: "Lanches",
        imageUrl: "",
        available: true,
        popular: true,
      },
    })
  ).json()
  expect(product.ok).toBe(true)
  const opened = await page.request.put(`/api/v1/restaurants/${store.id}/open`, {
    headers,
    data: { expectedRevision: product.value.revision, isOpen: true },
  })
  expect(opened.status()).toBe(200)
  await page.goto(`/admin/delivery?restaurant=${store.id}`)
  await page.getByLabel("Como calcular o frete").selectOption("RADIUS")
  await page.getByLabel("Aceitar retirada").check()
  await page.getByText("Informar coordenadas", { exact: true }).click()
  await page.getByLabel("Latitude do ponto").fill("0")
  await page.getByLabel("Longitude do ponto").fill("0")
  await page.getByRole("button", { name: "Confirmar ponto do endereço" }).click()
  for (const [distance, fee] of [
    ["1,113", "1,01"],
    ["2,226", "2,02"],
  ]) {
    await page.getByRole("button", { name: "Adicionar faixa", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Adicionar faixa de frete" })
    await dialog.getByLabel("Raio máximo da faixa (km)").fill(distance!)
    await dialog.getByLabel("Taxa da faixa (R$)").fill(fee!)
    await dialog.getByRole("button", { name: "Adicionar à lista" }).click()
    await expect(dialog).toHaveCount(0)
  }
  await page.getByRole("button", { name: "Salvar entregas" }).click()
  await expect(page.getByText("Entregas e retirada salvas.")).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Até 1,113 km" })).toBeVisible()
  await page.screenshot({ path: ".cache/radius-admin.png", fullPage: true })
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  await context.route(/https:\/\//, (route) => route.abort())
  const customer = await context.newPage()
  await customer.goto(`/menu/${slug}`)
  await expect(customer.getByText("Por distância", { exact: true })).toBeVisible()
  await customer
    .getByRole("button", { name: "Adicionar Lanche raio", exact: true })
    .click()
  await customer.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
  await customer.getByLabel("Seu nome completo *").fill("Cliente do Raio")
  await customer.getByLabel("Seu WhatsApp com DDD *").fill("11999999999")
  await fillDeliveryAddress(customer, "Rua do Cliente")
  const send = customer.getByRole("button", {
    name: "Enviar pedido para a loja",
    exact: true,
  })
  await expect(send).toBeDisabled()
  await expect(
    customer.getByRole("button", { name: "Usar minha localização" }),
  ).toBeDisabled()
  await customer.getByText("Informar coordenadas", { exact: true }).click()
  await customer.getByLabel("Latitude do ponto").fill("0")
  await customer.getByLabel("Longitude do ponto").fill("0,01")
  await customer.getByRole("button", { name: "Confirmar ponto do endereço" }).click()
  await expect(customer.locator(".order-summary__total")).toContainText("11,02")
  await customer.getByLabel("Longitude do ponto").fill("0.01001")
  await expect(send).toBeDisabled()
  await customer.getByRole("button", { name: "Confirmar ponto do endereço" }).click()
  await expect(customer.locator(".order-summary__total")).toContainText("12,03")
  await customer.getByLabel("Número do imóvel").fill("20")
  await expect(send).toBeDisabled()
  await customer.getByText("Informar coordenadas", { exact: true }).click()
  await customer.getByLabel("Latitude do ponto").fill("0")
  await customer.getByLabel("Longitude do ponto").fill("0.1")
  await customer.getByRole("button", { name: "Confirmar ponto do endereço" }).click()
  await expect(customer.getByRole("alert")).toContainText("fora do raio")
  await expect(send).toBeDisabled()
  await customer.getByLabel("Longitude do ponto").fill("0.02")
  await customer.getByRole("button", { name: "Confirmar ponto do endereço" }).click()
  await expect(customer.locator(".order-summary__total")).toContainText("12,03")
  await customer.getByRole("radio", { name: /Retirada/ }).check()
  await expect(customer.locator(".order-summary__total")).toContainText("10,01")
  await customer.getByRole("radio", { name: /Entrega/ }).check()
  await expect(customer.locator(".order-summary__total")).toContainText("12,03")
  await customer.screenshot({ path: ".cache/radius-checkout-mobile.png", fullPage: true })
  expect(
    await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  const ordered = customer.waitForResponse(
    (r) =>
      r.url().endsWith(`/public/restaurants/${slug}/orders`) &&
      r.request().method() === "POST",
  )
  await send.click()
  const receipt = await (await ordered).json()
  expect(receipt.ok).toBe(true)
  const persisted = await (
    await page.request.get(`/api/v1/restaurants/${store.id}/orders`)
  ).json()
  const order = persisted.value.items.find(
    (o: { id: string }) => o.id === receipt.value.orderId,
  )
  expect(order.total).toBe(1203)
  expect(order.deliveryFee).toBe(202)
  expect(order.fulfillment.radius).toMatchObject({
    distanceMeters: 2226,
    fee: 202,
    maxMeters: 2226,
  })
  await context.close()
})
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\//, (route) => route.abort())
})
test.afterAll(async () => {
  await mkdir(".cache", { recursive: true })
  await writeFile(".cache/api-browser-users.json", JSON.stringify(users), "utf8")
})
test("cadastro, catálogo, configurações, pedido real e troca de loja funcionam com MySQL", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = `loja-${randomUUID().slice(0, 8)}`
  await page.goto("/admin")
  expect(await page.evaluate(() => isSecureContext)).toBe(false)
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined")
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible()
  await page.getByRole("button", { name: "Primeiro acesso? Criar minha conta" }).click()
  await page.getByLabel("Seu nome *", { exact: true }).fill("José da Conceição")
  await page.getByLabel("E-mail *", { exact: true }).fill(`${slug}@browser.example.test`)
  await page.getByLabel("Senha *", { exact: true }).fill("12345678")
  await page.getByLabel("Nome da loja *", { exact: true }).fill("Cozinha São José")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill(slug)
  const registered = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/register") && response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Criar conta e loja", exact: true }).click()
  const account = await (await registered).json()
  expect(account.ok).toBe(true)
  users.push(account.value.user.id)
  await expect(
    page.getByRole("heading", { name: "Qual loja vamos cuidar hoje?" }),
  ).toBeVisible()
  await page
    .locator(".account-store-card")
    .filter({ hasText: "Cozinha São José" })
    .click()
  await expect(page.getByRole("heading", { name: "Gestão do Cardápio" })).toBeVisible()
  const firstStoreUrl = page.url()
  await expect(page.getByText("Nenhum produto encontrado")).toBeVisible()
  await page.getByRole("button", { name: "Novo produto", exact: true }).click()
  await page.getByLabel("Nome do produto *").fill("Açaí com paçoca")
  await page.getByLabel("Preço de venda *").fill("28.90")
  await page
    .getByRole("combobox", { name: "Categoria *", exact: true })
    .selectOption("__new__")
  await page.getByLabel("Nome da nova categoria *").fill("Porções especiais")
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()
  await page.getByRole("button", { name: "Editar Açaí com paçoca", exact: true }).click()
  await page.getByLabel("Preço de venda *").fill("29,50")
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.reload()
  await expect(
    page.locator("article").filter({ hasText: "Açaí com paçoca" }),
  ).toContainText(/29,50/)
  await page.getByRole("link", { name: "Configurações", exact: true }).click()
  await page.getByLabel("WhatsApp da loja com DDD").fill("11988888888")
  await page.getByLabel("Taxa de entrega *", { exact: true }).fill("5,00")
  await page.getByRole("button", { name: "Salvar configurações" }).click()
  await expect(page.getByText("Configurações salvas.")).toBeVisible()
  await page.getByRole("switch", { name: "Loja aberta" }).click()
  await expect(page.getByRole("switch", { name: "Loja aberta" })).toBeChecked()
  await page.getByRole("link", { name: "Pedidos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Pedidos", exact: true })).toBeVisible()
  await page.screenshot({ path: ".cache/api-orders-empty.png", fullPage: true })
  const customer = await browser.newContext({ baseURL })
  await customer.route(/https:\/\//, (route) => route.abort())
  const menu = await customer.newPage()
  await menu.setViewportSize({ width: 390, height: 844 })
  await menu.goto(`/menu/${slug}`)
  await expect(menu.getByText("Peça direto com a loja")).toBeVisible()
  await menu
    .getByRole("button", { name: "Adicionar Açaí com paçoca", exact: true })
    .click()
  await menu.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
  await menu.getByLabel("Seu nome completo *").fill("Cliente Açaí")
  await menu.getByLabel("Seu WhatsApp com DDD *").fill("11999999999")
  await menu.route("**/public/addresses/01001000", (route) =>
    route.fulfill({
      json: {
        ok: true,
        value: {
          cep: "01001000",
          state: "SP",
          city: "São Paulo",
          neighborhood: "Centro",
          street: "Rua São João",
          latitude: null,
          longitude: null,
        },
      },
    }),
  )
  await menu.getByLabel("CEP (opcional)").fill("01001000")
  await menu.getByLabel("CEP (opcional)").press("Tab")
  await expect(menu.getByLabel("Rua, avenida ou estrada")).toHaveValue("Rua São João")
  await expect(menu.getByLabel("Cidade do endereço")).toHaveValue("São Paulo")
  await expect(menu.getByLabel("Número do imóvel")).toHaveValue("")
  await menu
    .getByRole("button", { name: "Enviar pedido para a loja", exact: true })
    .click()
  await expect(menu.getByLabel("Número do imóvel")).toBeFocused()
  await menu.getByLabel("Número do imóvel").fill("10")
  await menu.getByLabel("Tipo de local").selectOption("APARTMENT")
  await menu
    .getByLabel("Complemento / bloco / apartamento")
    .fill("Bloco B, apartamento 12")
  await menu.getByLabel("Pagamento", { exact: true }).selectOption("Cartão na Entrega")
  await menu
    .getByRole("button", { name: "Enviar pedido para a loja", exact: true })
    .click()
  await expect(
    menu.getByRole("heading", { name: "Pedido enviado para a loja!" }),
  ).toBeVisible()
  await expect(
    menu.getByRole("link", { name: "Conversar com a loja no WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/5511988888888/)
  await menu.getByRole("button", { name: "Voltar ao cardápio", exact: true }).click()
  await expect(
    menu.getByRole("button", { name: "Abrir carrinho com 0 itens" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Atualizar pedidos" }).click()
  await expect(page.getByRole("heading", { name: "Cliente Açaí" })).toBeVisible()
  await page.screenshot({ path: ".cache/api-orders-desktop.png", fullPage: true })
  await page.getByRole("button", { name: "Ver detalhes", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Rua São João, 10")
  await expect(page.getByRole("dialog")).toContainText(
    "Complemento: Bloco B, apartamento 12",
  )
  await page.route("**/orders/*/status", (route) => route.abort())
  await page.getByRole("button", { name: "Cancelar pedido", exact: true }).click()
  await page.getByRole("button", { name: "Confirmar cancelamento", exact: true }).click()
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Não foi possível conectar",
  )
  await expect(page.getByRole("dialog")).toContainText("Cliente Açaí")
  await page.unroute("**/orders/*/status")
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Ver detalhes", exact: true }),
  ).toBeFocused()
  for (const name of [
    "Iniciar preparo",
    "Marcar como pronto",
    "Saiu para entrega",
    "Concluir pedido",
  ]) {
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/status") && response.request().method() === "PUT",
    )
    await page.getByRole("button", { name, exact: true }).click()
    expect((await updated).status()).toBe(200)
  }
  await page.getByRole("button", { name: "Concluídos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Cliente Açaí" })).toBeVisible()
  await page.getByRole("button", { name: "Ver detalhes", exact: true }).click()
  await page.getByRole("button", { name: "Registrar pagamento", exact: true }).click()
  await expect(page.getByLabel("Valor recebido (R$)", { exact: true })).toHaveValue(
    "34,50",
  )
  await expect(page.getByLabel("Forma de recebimento", { exact: true })).toHaveValue("")
  await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click()
  await expect(page.getByLabel("Forma de recebimento", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  )
  await page.getByLabel("Forma de recebimento", { exact: true }).selectOption("DEBIT")
  await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click()
  await expect(page.getByText("Pago integralmente", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Reverter", exact: true }).click()
  const reversal = page.getByRole("dialog", { name: "Reverter recebimento", exact: true })
  await expect(reversal).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(reversal).toHaveCount(0)
  await expect(page.getByRole("dialog")).toContainText("Cliente Açaí")
  await expect(page.getByRole("button", { name: "Reverter", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Reverter", exact: true }).click()
  await reversal
    .getByLabel("Motivo da reversão", { exact: true })
    .fill("Conferência do caixa de teste")
  await reversal.getByRole("button", { name: "Confirmar reversão", exact: true }).click()
  await expect(page.getByText("Saldo em aberto", { exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: ".cache/api-orders-mobile.png", fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole("link", { name: "Caixa e relatórios", exact: true }).click()
  await page.getByRole("button", { name: "Recebimento avulso", exact: true }).click()
  await page.getByLabel("Valor recebido (R$)", { exact: true }).fill("12,34")
  await page
    .getByLabel("Descrição do recebimento", { exact: true })
    .fill("Venda avulsa de teste")
  // Commit on the server, then lose the response. Retry must recover the same receipt.
  let attempts = 0
  await page.route("**/payments", async (route) => {
    if (route.request().method() === "POST" && attempts++ === 0) {
      await route.fetch()
      await route.abort()
    } else await route.continue()
  })
  await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Verificar recebimento", exact: true }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Recebimento avulso", exact: true }).click()
  await expect(page.getByLabel("Valor recebido (R$)", { exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Verificar recebimento", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.unroute("**/payments")
  await expect(
    page.getByRole("row").filter({ hasText: "Venda avulsa de teste" }),
  ).toHaveCount(1)
  await page.getByRole("button", { name: "Relatórios", exact: true }).click()
  await expect(
    page
      .locator(".finance-metrics article")
      .filter({ hasText: "Total dos pedidos válidos" }),
  ).toContainText("34,50")
  await expect(
    page
      .locator(".finance-metrics article")
      .filter({ hasText: "Recebimentos menos reversões" }),
  ).toContainText("12,34")
  await expect(
    page
      .locator(".finance-metrics article")
      .filter({ hasText: "Falta receber desses pedidos" }),
  ).toContainText("34,50")
  await expect(
    page.getByRole("region", { name: "Composição dos valores" }),
  ).toContainText("29,50")
  await expect(
    page.getByRole("region", { name: "Composição dos valores" }),
  ).toContainText("5,00")
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "Total do período", exact: true }),
    }),
  ).toContainText("46,84")
  await expect(
    page.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "Total do período", exact: true }),
    }),
  ).toContainText("34,50")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Baixar relatório PDF", exact: true }).click()
  const pdf = await download
  await pdf.saveAs(".cache/financial-report.pdf")
  await page.getByLabel("Saldo do pedido").selectOption("settled")
  await expect(page.getByText("Nenhum pedido corresponde aos filtros.")).toBeVisible()
  await expect(
    page
      .locator(".finance-metrics article")
      .filter({ hasText: "Total dos pedidos válidos" }),
  ).toContainText("34,50")
  await page.getByLabel("Saldo do pedido").selectOption("pending")
  await expect(
    page.getByRole("region", { name: "Pedidos do relatório" }).getByRole("row"),
  ).toHaveCount(2)
  expect((await readFile(".cache/financial-report.pdf")).subarray(0, 5).toString()).toBe(
    "%PDF-",
  )
  await page.getByRole("button", { name: "Baixar relatório PDF", exact: true }).blur()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: ".cache/finance-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/finance-mobile.png", fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole("link", { name: "Trocar de loja", exact: true }).click()
  await page.getByRole("button", { name: "Criar nova loja", exact: true }).click()
  await page.getByLabel("Nome da loja *", { exact: true }).fill("Outra cozinha")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill(`outra-${slug}`)
  await page.getByRole("button", { name: "Criar loja", exact: true }).click()
  await expect(page.getByText("Nenhum produto encontrado")).toBeVisible()
  await expect(page.getByRole("switch", { name: "Loja aberta" })).not.toBeChecked()
  await page.getByRole("link", { name: "Pedidos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Cliente Açaí" })).toHaveCount(0)
  await page.goto(firstStoreUrl)
  await expect(
    page.getByRole("heading", { name: "Açaí com paçoca", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible()
  await page.goto(firstStoreUrl)
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible()
  await customer.close()
})
test("adicionais, modelos, QR com logo e painel público ao vivo funcionam de ponta a ponta", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000)
  const slug = `extras-${randomUUID().slice(0, 8)}`,
    api = `${baseURL}/api/v1`,
    origin = baseURL!
  const registered = await page.request.post(`${api}/auth/register`, {
    headers: { origin },
    data: {
      name: "Gestor Extras",
      email: `${slug}@browser.example.test`,
      password: "12345678",
      restaurantName: "Casa dos Extras",
      slug,
    },
  })
  const session = await registered.json()
  expect(session.ok).toBe(true)
  users.push(session.value.user.id)
  const stores = await (await page.request.get(`${api}/me/restaurants`)).json(),
    id = stores.value[0].id
  const headers = { origin, "x-csrf-token": session.value.csrfToken }
  let result = await (
    await page.request.post(`${api}/restaurants/${id}/products`, {
      headers,
      data: {
        expectedRevision: 0,
        name: "Burger da casa",
        description: "Preparado na hora",
        price: "20,00",
        categoryId: "",
        newCategoryName: "Lanches",
        imageUrl: "",
        available: true,
        popular: false,
      },
    })
  ).json()
  expect(result.ok).toBe(true)
  const logo = new PNG({ width: 256, height: 64 })
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 256; x++) {
      const offset = (y * 256 + x) * 4,
        white = (x > 110 && x < 140) || (y > 24 && y < 39)
      logo.data.set(white ? [255, 255, 255, 0] : [27, 80, 63, 255], offset)
    }
  result = await (
    await page.request.put(`${api}/restaurants/${id}/settings`, {
      headers,
      data: {
        expectedRevision: result.value.revision,
        name: "Casa dos Extras",
        description: "Lanches feitos na hora",
        whatsapp: "",
        address: "",
        logoUrl: `data:image/png;base64,${PNG.sync.write(logo).toString("base64")}`,
        coverUrl: "",
        deliveryFee: "0,00",
        minOrder: "0,00",
        eta: "20–30 minutos",
      },
    })
  ).json()
  expect(result.ok).toBe(true)
  result = await (
    await page.request.put(`${api}/restaurants/${id}/open`, {
      headers,
      data: { expectedRevision: result.value.revision, isOpen: true },
    })
  ).json()
  expect(result.ok).toBe(true)
  await page.goto(`/admin/addons?restaurant=${id}`)
  await page.getByRole("button", { name: "Novo grupo", exact: true }).click()
  await page.getByLabel("Nome do grupo", { exact: true }).fill("Turbine seu lanche")
  await page.getByLabel("Quantidade mínima", { exact: true }).fill("1")
  await page.getByLabel("Nome da opção 1", { exact: true }).fill("Queijo extra")
  await page.getByLabel("Preço da opção 1 (R$)", { exact: true }).fill("2,50")
  await page.getByLabel("Limite da opção 1", { exact: true }).fill("2")
  await page.getByLabel("Burger da casa", { exact: true }).check()
  await page.reload()
  await page.getByRole("button", { name: "Novo grupo", exact: true }).click()
  await expect(page.getByLabel("Nome do grupo", { exact: true })).toHaveValue(
    "Turbine seu lanche",
  )
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/addons-form-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Salvar grupo", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Turbine seu lanche" })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 900 })
  // Exercise Docker's image/connect restrictions without intercepting the LAN
  // document (Chromium classifies fulfilled documents as a different address space).
  await page.evaluate(() => {
    const policy = document.createElement("meta")
    policy.httpEquiv = "Content-Security-Policy"
    policy.content = "connect-src 'self'; img-src 'self' data: blob: https:"
    document.head.append(policy)
  })
  await page.getByRole("link", { name: "Aparência e QR Code", exact: true }).click()
  await page.getByLabel("Modelo do cardápio", { exact: true }).selectOption("COMPACT")
  await page.getByLabel("Cor de destaque", { exact: true }).selectOption("PLUM")
  await page
    .getByLabel("Mensagem de boas-vindas", { exact: true })
    .fill("Seu lanche, do seu jeito")
  await page.getByRole("button", { name: "Publicar aparência", exact: true }).click()
  await expect(page.getByText("Aparência publicada.", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Incluir logo da loja", { exact: true })).toBeChecked()
  for (const style of ["rounded", "square", "dots"]) {
    await page.getByLabel("Modelo do QR Code", { exact: true }).selectOption(style)
    await expect(
      page.getByRole("button", { name: "Baixar PNG", exact: true }),
    ).toBeEnabled()
    const pending = page.waitForEvent("download")
    await page.getByRole("button", { name: "Baixar PNG", exact: true }).click()
    const download = await pending,
      path = `.cache/menu-qr-${style}.png`
    await download.saveAs(path)
    const png = PNG.sync.read(await readFile(path)),
      decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(decoded?.data).toBe(`${origin}/menu/${slug}`)
  }
  const svgDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Baixar SVG", exact: true }).click()
  await (await svgDownload).saveAs(".cache/menu-qr-logo.svg")
  const svg = await readFile(".cache/menu-qr-logo.svg", "utf8")
  expect(svg).toContain("data:image/png;base64,")
  expect(svg).not.toMatch(/(?:href|src)="https?:/)
  await expect(
    page.getByRole("button", { name: "Publicar aparência", exact: true }),
  ).toBeEnabled()
  await expect(page.getByText("O cardápio mudou.", { exact: false })).toHaveCount(0)
  await page.getByRole("button", { name: "Baixar PNG", exact: true }).blur()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: ".cache/appearance-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/appearance-mobile.png", fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page
    .getByRole("link", { name: "Painel ao vivo e mensagens", exact: true })
    .click()
  const boardToggle = page.getByLabel("Disponibilizar painel público", { exact: true })
  await boardToggle.click()
  await expect(boardToggle).not.toBeChecked()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("button", { name: "Confirmar alteração", exact: true }).click()
  await expect(boardToggle).toBeChecked()
  const link = page.getByRole("link", { name: "Abrir painel para TV", exact: true })
  await expect(link).toBeVisible()
  const boardContext = await browser.newContext(),
    board = await boardContext.newPage()
  await board.goto((await link.getAttribute("href"))!)
  await expect(board.getByRole("status")).toContainText(/ao vivo/i)
  const customerContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 320, height: 740 },
  })
  const customer = await customerContext.newPage()
  await customer.goto(`/menu/${slug}`)
  await expect(customer.locator(".menu-theme--compact.menu-color--plum")).toBeVisible()
  await customer.getByRole("button", { name: /Personalizar/ }).click()
  await expect(
    customer.getByRole("button", { name: "Adicionar ao carrinho", exact: true }),
  ).toBeDisabled()
  await customer
    .getByRole("button", { name: "Adicionar Queijo extra", exact: true })
    .click()
  await customer.reload()
  await customer.getByRole("button", { name: /Personalizar/ }).click()
  await expect(
    customer.getByRole("group", { name: "Quantidade de Queijo extra" }),
  ).toContainText("1")
  await customer.screenshot({ path: ".cache/addon-customer-mobile.png", fullPage: true })
  await customer
    .getByRole("button", { name: "Adicionar ao carrinho", exact: true })
    .click()
  await customer.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
  await customer.getByLabel("Seu nome completo *").fill("Cliente Privado")
  await customer.getByLabel("Seu WhatsApp com DDD *").fill("11999999999")
  await fillDeliveryAddress(customer, "Rua Reservada", "1")
  await expect(customer.locator(".order-summary__total")).toContainText("22,50")
  const ordered = customer.waitForResponse(
    (r) =>
      r.url().endsWith(`/public/restaurants/${slug}/orders`) &&
      r.request().method() === "POST",
  )
  await customer
    .getByRole("button", { name: "Enviar pedido para a loja", exact: true })
    .click()
  const receipt = await (await ordered).json()
  expect(receipt.ok).toBe(true)
  const number = `#${receipt.value.orderId.slice(0, 8).toUpperCase()}`
  await expect(
    board.getByRole("region", { name: "Recebidos", exact: true }).getByText(number),
  ).toBeVisible({ timeout: 15000 })
  await expect(board.locator("body")).not.toContainText("Cliente Privado")
  await expect(board.locator("body")).not.toContainText("11999999999")
  await page.getByRole("link", { name: "Pedidos", exact: true }).click()
  await page.getByRole("button", { name: "Iniciar preparo", exact: true }).click()
  await expect(
    board.getByRole("region", { name: "Em preparo", exact: true }).getByText(number),
  ).toBeVisible({ timeout: 15000 })
  await board.screenshot({ path: ".cache/public-board-tv.png", fullPage: true })
  const key = new URL(board.url()).hash
  await board.getByRole("button", { name: "Modo celular", exact: true }).click()
  expect(new URL(board.url()).hash).toBe(key)
  await board.setViewportSize({ width: 320, height: 740 })
  expect(
    await board.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await board.screenshot({ path: ".cache/public-board-mobile.png", fullPage: true })
  await boardContext.setOffline(true)
  await expect(board.locator(".board-connection")).toHaveClass(/is-offline/, {
    timeout: 25000,
  })
  await boardContext.setOffline(false)
  await expect(board.getByRole("status")).toContainText(/ao vivo/i, { timeout: 15000 })
  await page
    .getByRole("link", { name: "Painel ao vivo e mensagens", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Gerar novo link e invalidar o anterior", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar alteração", exact: true }).click()
  await expect(board.getByRole("status")).toContainText(/expirado|desativado/, {
    timeout: 15000,
  })
  await boardContext.close()
  await customerContext.close()
})

test("API indisponível não cria demonstração nem libera administração", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) => route.abort())
  await page.goto("/menu/loja-inexistente")
  await expect(page.getByRole("alert")).toContainText("Não foi possível conectar")
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", { name: "Não foi possível acessar suas lojas" }),
  ).toBeVisible()
  await expect(page.getByText("Burger House")).toHaveCount(0)
})

test("combos, cupons, bairros, rascunhos e acompanhamento funcionam no celular", async ({
  page,
  browser,
  baseURL,
}) => {
  const slug = `combo-${randomUUID().slice(0, 8)}`
  await page.goto("/login?equipe=1")
  // Switch from team-only signup to a store account using the visible option.
  await page.getByLabel("Faço parte de uma equipe; não quero criar uma loja").uncheck()
  await page.getByLabel("Seu nome *", { exact: true }).fill("Ana Conceição")
  await page.getByLabel("E-mail *", { exact: true }).fill(`${slug}@browser.example.test`)
  await page.getByLabel("Senha *", { exact: true }).fill("12345678")
  await page.getByLabel("Nome da loja *", { exact: true }).fill("Cozinha da Praça")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill(slug)
  const registered = page.waitForResponse(
    (r) => r.url().endsWith("/auth/register") && r.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Criar conta e loja", exact: true }).click()
  const account = await (await registered).json()
  expect(account.ok).toBe(true)
  users.push(account.value.user.id)
  await page
    .locator(".account-store-card")
    .filter({ hasText: "Cozinha da Praça" })
    .click()
  for (const [name, price] of [
    ["Hambúrguer da praça", "30,00"],
    ["Suco de maçã", "10,00"],
  ]) {
    await page.getByRole("button", { name: "Novo produto", exact: true }).click()
    await page.getByLabel("Nome do produto *").fill(name!)
    await page.getByLabel("Preço de venda *").fill(price!)
    await page
      .getByRole("combobox", { name: "Categoria *", exact: true })
      .selectOption("__new__")
    await page.getByLabel("Nome da nova categoria *").fill(name!)
    await page.reload()
    await expect(page.getByLabel("Nome do produto *")).toHaveValue(name!)
    await expect(page.getByLabel("Preço de venda *")).toHaveValue(price!)
    await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
  }
  await page.getByRole("switch", { name: "Loja aberta" }).click()
  await expect(page.getByRole("switch", { name: "Loja aberta" })).toBeChecked()
  await page.getByRole("link", { name: "Combos e promoções", exact: true }).click()
  await page.getByRole("button", { name: "Novo combo", exact: true }).click()
  await page.getByLabel("Nome do combo").fill("Dupla da Praça")
  await page.getByLabel("Preço do combo (R$)").fill("35,00")
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Seu hambúrguer favorito com suco fresquinho.")
  await page.getByRole("button", { name: "Incluir produto fixo" }).click()
  await page
    .getByLabel("Produto fixo 1", { exact: true })
    .selectOption({ label: "Hambúrguer da praça" })
  await page.getByRole("button", { name: "Criar grupo de escolhas" }).click()
  await page.getByLabel("Nome da escolha 1").fill("Escolha sua bebida")
  await page
    .getByLabel("Opção 1", { exact: true })
    .selectOption({ label: "Suco de maçã" })
  await page.getByLabel("Adicional (R$)").fill("2,00")
  await page.reload()
  await expect(page.getByLabel("Nome do combo")).toHaveValue("Dupla da Praça")
  await expect(page.getByLabel("Adicional (R$)")).toHaveValue("2,00")
  await page.getByRole("button", { name: "Salvar combo", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.screenshot({ path: ".cache/combos-admin.png", fullPage: true })
  await page.getByRole("button", { name: /^Promoções/ }).click()
  await page.getByRole("button", { name: "Nova promoção", exact: true }).click()
  await page.getByLabel("Nome da promoção").fill("Boas-vindas da praça")
  await page.getByLabel("Código do cupom (opcional)").fill("PRACA10")
  await page.getByLabel("Aplicar também aos combos").check()
  await page.getByRole("button", { name: "Salvar promoção", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("link", { name: "Entregas e retirada", exact: true }).click()
  await page.getByLabel("Como calcular o frete").selectOption("ZONES")
  await page.getByLabel("Aceitar retirada").check()
  await page.getByRole("button", { name: "Adicionar bairro", exact: true }).click()
  await page.getByLabel("Estado", { exact: true }).selectOption("SP")
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo")
  await page.getByLabel("Bairro", { exact: true }).fill("Centro")
  await page.getByLabel("Taxa de entrega (R$)").fill("7,00")
  await page.getByText("Referência no mapa (opcional)", { exact: true }).click()
  await page.getByLabel("Latitude", { exact: true }).fill("-23.55")
  await page.getByLabel("Longitude", { exact: true }).fill("-46.63")
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click()
  await page.getByRole("button", { name: "Adicionar bairro", exact: true }).click()
  await page.getByLabel("Estado", { exact: true }).selectOption("SP")
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo")
  await page.getByLabel("Bairro", { exact: true }).fill("Vila Nova")
  await page.getByLabel("Taxa de entrega (R$)").fill("9,00")
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Centro", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Salvar entregas", exact: true }).click()
  await expect(page.getByText("Entregas e retirada salvas.")).toBeVisible()
  await page.screenshot({ path: ".cache/delivery-admin.png", fullPage: true })
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  await context.route(/https:\/\//, (route) => route.abort())
  const customer = await context.newPage()
  await customer.goto(`/menu/${slug}`)
  await customer.screenshot({ path: ".cache/combos-mobile.png", fullPage: true })
  await customer.getByRole("button", { name: "Escolher combo", exact: true }).click()
  await expect(
    customer.getByRole("button", { name: "Adicionar combo ao carrinho" }),
  ).toBeDisabled()
  await customer.getByRole("radio", { name: /Suco de maçã/ }).check()
  await customer.reload()
  await expect(customer.getByRole("radio", { name: /Suco de maçã/ })).toBeChecked()
  await customer.getByRole("button", { name: "Adicionar combo ao carrinho" }).click()
  await customer.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
  await customer.getByLabel("Cidade de entrega").selectOption("São Paulo / SP")
  await customer
    .getByLabel("Bairro de entrega")
    .selectOption({ label: "Centro · R$ 7,00" })
  await customer.getByLabel("Seu nome completo *").fill("João Açúcar")
  await customer.getByLabel("Seu WhatsApp com DDD *").fill("11999999999")
  await fillDeliveryAddress(customer, "Praça da Sé", "10", false)
  await customer.getByLabel("Cupom de desconto").fill("PRACA10")
  await customer.reload()
  await expect(customer.getByLabel("Seu nome completo *")).toHaveValue("João Açúcar")
  await expect(customer.getByLabel("Rua, avenida ou estrada")).toHaveValue("Praça da Sé")
  await expect(customer.getByLabel("Cupom de desconto")).toHaveValue("PRACA10")
  await expect(customer.locator(".order-summary__total")).toContainText("40,30")
  await customer
    .getByLabel("Bairro de entrega")
    .selectOption({ label: "Vila Nova · R$ 9,00" })
  await expect(customer.locator(".order-summary__total")).toContainText("42,30")
  await expect(customer.getByLabel("Bairro do endereço")).toHaveValue("Vila Nova")
  await customer
    .getByLabel("Bairro de entrega")
    .selectOption({ label: "Centro · R$ 7,00" })
  await expect(customer.locator(".order-summary__total")).toContainText("40,30")
  await customer.getByRole("button", { name: "Ver mapa de referência" }).click()
  await expect(customer.getByText(/O mapa não pôde ser carregado/)).toBeVisible()
  await customer.screenshot({
    path: ".cache/checkout-regional-mobile.png",
    fullPage: true,
  })
  expect(
    await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  // The server commits, but the response is lost. Reload must recover the same order.
  let orderId = ""
  await customer.route("**/public/restaurants/*/orders", async (route) => {
    const response = await route.fetch()
    const result = await response.json()
    orderId = result.value.orderId
    await route.abort()
  })
  await customer
    .getByRole("button", { name: "Enviar pedido para a loja", exact: true })
    .click()
  await expect(
    customer.getByRole("alert").filter({ hasText: "Não foi possível conectar" }),
  ).toBeVisible()
  await customer.unroute("**/public/restaurants/*/orders")
  await page.getByRole("switch", { name: "Loja aberta" }).click()
  await page.getByRole("button", { name: "Confirmar fechamento", exact: true }).click()
  await expect(page.getByRole("switch", { name: "Loja aberta" })).not.toBeChecked()
  await customer.reload()
  await expect(
    customer.getByRole("button", { name: "Enviar pedido para a loja", exact: true }),
  ).toBeDisabled()
  await customer
    .getByRole("button", { name: "Recuperar envio anterior", exact: true })
    .click()
  await expect(
    customer.getByRole("heading", { name: "Seu envio anterior já foi registrado" }),
  ).toBeVisible()
  await customer
    .getByRole("button", { name: "Limpar carrinho deste pedido e voltar", exact: true })
    .click()
  await customer.getByRole("link", { name: /^Acompanhar #/ }).click()
  await expect(customer.locator(".order-timeline [aria-current=step]")).toContainText(
    "Pedido recebido",
  )
  expect(customer.url()).toContain(orderId)
  const whatsappPreference = customer.getByRole("checkbox", {
    name: "Receber atualizações deste pedido pelo WhatsApp",
  })
  await expect(whatsappPreference).not.toBeChecked()
  await expect(
    customer.getByText(/A loja ainda não ativou o envio por WhatsApp/),
  ).toBeVisible()
  // The controlled preference changes only after server confirmation, not at click time.
  await whatsappPreference.click()
  await expect(whatsappPreference).toBeChecked()
  await expect(customer.locator(".customer-notifications [role=alert]")).toHaveCount(0)
  await customer.reload()
  await expect(whatsappPreference).toBeChecked()
  await whatsappPreference.click()
  await expect(whatsappPreference).not.toBeChecked()
  await expect(customer.locator(".customer-notifications [role=alert]")).toHaveCount(0)
  await customer.reload()
  await expect(whatsappPreference).not.toBeChecked()
  await page.getByRole("link", { name: "Pedidos", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "João Açúcar", exact: true }),
  ).toHaveCount(1)
  await page.getByRole("button", { name: "Iniciar preparo", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Marcar como pronto", exact: true }),
  ).toBeVisible()
  await customer.getByRole("button", { name: "Atualizar acompanhamento" }).click()
  await expect(customer.locator(".order-timeline [aria-current=step]")).toContainText(
    "Em preparo",
  )
  await customer.screenshot({ path: ".cache/tracking-mobile.png", fullPage: true })
  await customer.getByRole("link", { name: "Voltar ao cardápio", exact: true }).click()
  await expect(
    customer.getByRole("button", { name: "Abrir carrinho com 0 itens" }),
  ).toBeVisible()
  const staffContext = await browser.newContext({ baseURL })
  await staffContext.route(/https:\/\//, (route) => route.abort())
  const staff = await staffContext.newPage(),
    email = `equipe-${slug}@browser.example.test`
  await staff.goto("/login?equipe=1")
  await staff.getByLabel("Seu nome *", { exact: true }).fill("Equipe Cozinha")
  await staff.getByLabel("E-mail *", { exact: true }).fill(email)
  await staff.getByLabel("Senha *", { exact: true }).fill("12345678")
  const teamRegistered = staff.waitForResponse((r) =>
    r.url().endsWith("/auth/register-account"),
  )
  await staff
    .getByRole("button", { name: "Criar minha conta de equipe", exact: true })
    .click()
  const teamAccount = await (await teamRegistered).json()
  expect(teamAccount.ok).toBe(true)
  users.push(teamAccount.value.user.id)
  await expect(staff.getByText(/Sua conta ainda não tem lojas/)).toBeVisible()
  await page.getByRole("link", { name: "Equipe e permissões", exact: true }).click()
  await page.getByLabel("E-mail da conta", { exact: true }).fill(email)
  await page.getByLabel("Perfil de acesso").selectOption("KITCHEN")
  await page.getByRole("button", { name: "Salvar acesso", exact: true }).click()
  await expect(
    page.getByText("Acesso salvo. As permissões já estão em vigor."),
  ).toBeVisible()
  await staff.getByRole("button", { name: "Atualizar meus acessos" }).click()
  await staff
    .locator(".account-store-card")
    .filter({ hasText: "Cozinha da Praça" })
    .click()
  await expect(staff.getByRole("heading", { name: "Cliente", exact: true })).toBeVisible()
  await expect(
    staff.getByRole("heading", { name: "João Açúcar", exact: true }),
  ).toHaveCount(0)
  await expect(
    staff.getByRole("link", { name: "Equipe e permissões", exact: true }),
  ).toHaveCount(0)
  await staff.getByRole("button", { name: "Ver detalhes", exact: true }).click()
  await expect(staff.getByRole("dialog")).not.toContainText("Praça da Sé")
  await expect(
    staff.getByRole("button", { name: "Cancelar pedido", exact: true }),
  ).toHaveCount(0)
  await staff.keyboard.press("Escape")
  await staff.getByRole("button", { name: "Marcar como pronto", exact: true }).click()
  await staffContext.close()
  await context.close()
})

test("cadastro valida todos os campos antes da API e preserva a senha exata", async ({
  page,
}) => {
  let submissions = 0
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/register") && request.method() === "POST")
      submissions++
  })
  await page.goto("/login")
  await page.getByRole("button", { name: "Primeiro acesso? Criar minha conta" }).click()
  await page.getByLabel("Seu nome *", { exact: true }).fill("123")
  await page.getByLabel("E-mail *", { exact: true }).fill("email-invalido")
  const password = page.getByLabel("Senha *", { exact: true })
  await password.fill("1234567")
  await page.getByLabel("Nome da loja *", { exact: true }).fill(" ")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill("a!")
  await page.getByRole("button", { name: "Criar conta e loja", exact: true }).click()
  await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(5)
  await expect(page.getByLabel("Seu nome *", { exact: true })).toBeFocused()
  await expect(password).toHaveValue("1234567")
  expect(submissions).toBe(0)
  await page.getByLabel("Seu nome *", { exact: true }).fill("João D’Ávila")
  await page.getByLabel("E-mail *", { exact: true }).fill("JOAO@EXEMPLO.COM")
  await password.fill(" frase  ")
  await page.getByLabel("Nome da loja *", { exact: true }).fill("Açaí da Praça")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill("Açaí da Praça")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).press("Tab")
  await expect(page.getByLabel("E-mail *", { exact: true })).toHaveValue(
    "joao@exemplo.com",
  )
  await expect(page.getByLabel("Endereço do cardápio *", { exact: true })).toHaveValue(
    "acai-da-praca",
  )
  await expect(password).toHaveValue(" frase  ")
  await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(0)
  await password.fill("x".repeat(129))
  await password.press("Tab")
  await expect(password).toHaveValue("x".repeat(129))
  await expect(password).toHaveAttribute("aria-invalid", "true")
  expect(submissions).toBe(0)
})
