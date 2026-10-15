import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
const users: string[] = []
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
}) => {
  const slug = `loja-${randomUUID().slice(0, 8)}`
  await page.goto("/admin")
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
  const customer = await browser.newContext({ baseURL: "http://127.0.0.1:4176" })
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
  await menu.getByLabel("Endereço de entrega completo *").fill("Rua São João, 10")
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
  for (const name of ["Iniciar preparo", "Saiu para entrega", "Concluir pedido"])
    await page.getByRole("button", { name, exact: true }).click()
  await page.getByRole("button", { name: "Concluídos", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Cliente Açaí" })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: ".cache/api-orders-mobile.png", fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
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
test("API indisponível não cria demonstração nem libera administração", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:3002/**", (route) => route.abort())
  await page.goto("/menu/loja-inexistente")
  await expect(page.getByRole("alert")).toContainText("Não foi possível conectar")
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await page.goto("/admin")
  await expect(
    page.getByRole("heading", { name: "Não foi possível acessar suas lojas" }),
  ).toBeVisible()
  await expect(page.getByText("Burger House")).toHaveCount(0)
})
