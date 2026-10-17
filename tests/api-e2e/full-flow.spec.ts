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
  for (const name of [
    "Iniciar preparo",
    "Marcar como pronto",
    "Saiu para entrega",
    "Concluir pedido",
  ])
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

test("combos, cupons, bairros, rascunhos e acompanhamento funcionam no celular", async ({
  page,
  browser,
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
  await page.reload()
  await expect(page.getByRole("heading", { name: "Centro", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Salvar entregas", exact: true }).click()
  await expect(page.getByText("Entregas e retirada salvas.")).toBeVisible()
  await page.screenshot({ path: ".cache/delivery-admin.png", fullPage: true })
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4176",
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
  await customer.getByLabel("Endereço de entrega completo *").fill("Praça da Sé, 10")
  await customer.getByLabel("Cupom de desconto").fill("PRACA10")
  await customer.reload()
  await expect(customer.getByLabel("Seu nome completo *")).toHaveValue("João Açúcar")
  await expect(customer.getByLabel("Endereço de entrega completo *")).toHaveValue(
    "Praça da Sé, 10",
  )
  await expect(customer.getByLabel("Cupom de desconto")).toHaveValue("PRACA10")
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
  const staffContext = await browser.newContext({ baseURL: "http://127.0.0.1:4176" })
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
