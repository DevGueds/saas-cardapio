import { expect, test, type Page } from "@playwright/test"

const storageKey = "saas-cardapio:v1:restaurant:demo-store"

test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\//, (route) => route.abort())
})

async function configureWhatsApp(page: Page) {
  await page.goto("/admin/settings")

  await page.getByLabel("WhatsApp da loja com DDD").fill("11999998888")

  await page.getByRole("button", { name: "Salvar configurações" }).click()

  await expect(page.getByText("Configurações salvas.")).toBeVisible()
}

async function addAndFillCheckout(page: Page) {
  await page.goto("/menu/burger-house")

  await page
    .getByRole("button", { name: "Adicionar Smash Clássico", exact: true })
    .click()

  await page.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()

  await page.getByLabel("Seu nome completo *").fill("José da Conceição")

  await page.getByLabel("Seu WhatsApp com DDD *").fill("55999998888")

  await page.getByLabel("Endereço de entrega completo *").fill("Rua São João, 10")
}

test("cardápio preserva português, carrinho vazio e foco do diálogo em telas pequenas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Burger House" })).toBeVisible()

  await expect(page.getByText("Cardápio demo · dados locais")).toBeVisible()

  const trigger = page.getByRole("button", {
    name: "Abrir carrinho com 0 itens",
  })

  await trigger.click()

  await expect(
    page.getByRole("heading", { name: "Seu carrinho está vazio" }),
  ).toBeVisible()

  await page.keyboard.press("Escape")

  await expect(page.getByRole("dialog")).toHaveCount(0)

  await expect(trigger).toBeFocused()

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
})

test("cria categoria e produto, edita e exclui sem recriar exemplos", async ({
  page,
}) => {
  await page.goto("/admin/menu")

  await expect(page.getByRole("heading", { name: "Gestão do Cardápio" })).toBeVisible()

  await page.getByRole("button", { name: "Novo produto", exact: true }).click()

  await page.getByLabel("Nome do produto *").fill("Açaí com paçoca")

  await page.getByLabel("Preço de venda *").fill("28.90")

  await page
    .getByRole("combobox", { name: "Categoria *", exact: true })
    .selectOption("__new__")

  await page.getByLabel("Nome da nova categoria *").fill("Porções especiais")

  await page.getByRole("button", { name: "Salvar produto" }).click()

  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()

  await expect(page.getByRole("heading", { name: "Açaí com paçoca" })).toBeVisible()

  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Açaí com paçoca" }) })

  await expect(card).toContainText(/R\$\s*28,90/)

  await page.reload()

  await page.getByRole("button", { name: "Editar Açaí com paçoca", exact: true }).click()

  await page.getByLabel("Preço de venda *").fill("29,50")

  await page.getByRole("button", { name: "Salvar produto" }).click()

  await expect(card).toContainText(/R\$\s*29,50/)

  await page.getByRole("button", { name: "Excluir Açaí com paçoca", exact: true }).click()

  await page.getByRole("button", { name: "Confirmar exclusão" }).click()

  await expect(page.getByText("Produto excluído.")).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: "Açaí com paçoca" })).toHaveCount(0)
})

test("gravação recusada preserva formulário e não informa sucesso", async ({ page }) => {
  await page.goto("/admin/menu")

  await page.getByRole("button", { name: "Novo produto", exact: true }).click()

  await page.getByLabel("Nome do produto *").fill("Produto preservado")

  await page.getByLabel("Preço de venda *").fill("28,90")

  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError")
    }
  })

  await page.getByRole("button", { name: "Salvar produto" }).click()

  await expect(page.getByText(/O armazenamento está cheio/)).toBeVisible()

  await expect(page.getByLabel("Nome do produto *")).toHaveValue("Produto preservado")

  await expect(page.getByRole("dialog")).toBeVisible()

  await expect(page.getByText("Produto salvo com sucesso.")).toHaveCount(0)
})

test("checkout prepara o link e o invalida após mudança em outra aba", async ({
  page,
  context,
}) => {
  const requests: string[] = []

  page.on("request", (request) => requests.push(request.url()))

  await configureWhatsApp(page)

  await addAndFillCheckout(page)

  await page.getByRole("button", { name: "Preparar pedido para WhatsApp" }).click()

  const link = page.getByRole("link", {
    name: "Abrir WhatsApp e enviar pedido",
  })

  await expect(link).toBeVisible()

  const url = new URL((await link.getAttribute("href"))!)

  expect(url.pathname).toBe("/5511999998888")

  expect(url.searchParams.get("text")).toContain("José da Conceição")

  expect(url.searchParams.get("text")).toContain("Rua São João, 10")

  expect(url.searchParams.get("text")).toContain("5555999998888")

  expect(requests.some((url) => /supabase|rest\/v1|wa\.me/.test(url))).toBe(false)

  const admin = await context.newPage()
  await admin.goto("/admin/menu")

  await admin.getByRole("switch", { name: "Loja aberta" }).click()
  await admin.getByRole("button", { name: "Confirmar fechamento", exact: true }).click()

  await expect(
    page.getByText("A loja está fechada e não está recebendo pedidos."),
  ).toBeVisible()

  await expect(link).toHaveCount(0)

  await expect(
    page.getByRole("button", { name: "Preparar pedido para WhatsApp" }),
  ).toBeDisabled()
})

test("duas abas editando o mesmo produto recebem conflito em vez de sobrescrever", async ({
  page,
  context,
}) => {
  await page.goto("/admin/menu")

  const other = await context.newPage()
  await other.goto("/admin/menu")

  await page.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()

  await other.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()

  await page.getByLabel("Preço de venda *").fill("31,00")

  await page.getByRole("button", { name: "Salvar produto" }).click()

  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()

  await other.getByLabel("Preço de venda *").fill("32,00")

  await other.getByRole("button", { name: "Salvar produto" }).click()

  await expect(other.getByText(/Outra alteração foi salva/)).toBeVisible()

  await expect(other.getByLabel("Preço de venda *")).toHaveValue("32,00")

  const saved = await other.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  )

  expect(
    saved.products.find((product: { id: string }) => product.id === "prod-1").price,
  ).toBe(3100)
})

test("mudança de preço requer atualização explícita do carrinho", async ({
  page,
  context,
}) => {
  await configureWhatsApp(page)
  await addAndFillCheckout(page)

  const admin = await context.newPage()
  await admin.goto("/admin/menu")

  await admin.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()

  await admin.getByLabel("Preço de venda *").fill("30,00")

  await admin.getByRole("button", { name: "Salvar produto" }).click()

  await expect(
    page.getByText(/O catálogo mudou: há produtos removidos ou preços atualizados/),
  ).toBeVisible()

  await expect(
    page.getByRole("button", { name: "Preparar pedido para WhatsApp" }),
  ).toBeDisabled()

  await page.getByRole("button", { name: "Atualizar itens do carrinho" }).click()

  await page.getByRole("button", { name: "Preparar pedido para WhatsApp" }).click()

  await expect(
    page.getByRole("link", { name: "Abrir WhatsApp e enviar pedido" }),
  ).toBeVisible()
})

test("legado vazio migra sem voltar aos produtos demonstrativos", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("test-initialized")) {
      localStorage.setItem("saas_cardapio_products", "[]")
      localStorage.setItem("test-initialized", "true")
    }
  })

  await page.goto("/admin/menu")

  await expect(
    page.getByRole("heading", { name: "Nenhum produto encontrado" }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Nenhum produto encontrado" }),
  ).toBeVisible()

  expect(await page.evaluate(() => localStorage.getItem("saas_cardapio_products"))).toBe(
    "[]",
  )
})

test("dados corrompidos bloqueiam a tela e permanecem preservados", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{invalid"), storageKey)

  await page.goto("/")

  await expect(page.getByText(/Os dados salvos estão inválidos/)).toBeVisible()

  await expect(page.getByRole("heading", { name: "Burger House" })).toHaveCount(0)

  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(
    "{invalid",
  )
})

test("slugs desconhecidos não exibem a loja padrão e rotas administrativas respeitam o histórico", async ({
  page,
}) => {
  await page.goto("/menu/desconhecido")

  await expect(page.getByText("Restaurante não encontrado.")).toBeVisible()

  await page.goto("/admin/products")
  await expect(page).toHaveURL(/\/admin\/menu$/)

  await page.getByRole("link", { name: "Configurações" }).click()

  await expect(page.getByRole("heading", { name: "Configurações da loja" })).toBeVisible()

  await page.getByRole("link", { name: "Pedidos demonstrativos" }).click()

  await expect(page.getByRole("heading", { name: "Gestor de Pedidos" })).toBeVisible()

  await expect(
    page.getByRole("button", { name: "Contato indisponível na demonstração" }).first(),
  ).toBeDisabled()

  await page.goBack()
  await expect(page.getByRole("heading", { name: "Configurações da loja" })).toBeVisible()

  await page.goForward()
  await expect(page.getByRole("heading", { name: "Gestor de Pedidos" })).toBeVisible()
})

test("upload e arraste rejeitam o mesmo arquivo inválido", async ({ page }) => {
  await page.goto("/admin/menu")
  await page.getByRole("button", { name: "Novo produto", exact: true }).click()

  await page.getByLabel("Foto do produto", { exact: true }).setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid bytes"),
  })

  await expect(page.getByText(/O conteúdo do arquivo não corresponde/)).toBeVisible()

  const drop = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(["invalid bytes"], "fake.png", { type: "image/png" }))
    return data
  })

  await page
    .getByRole("button", { name: /Clique ou arraste uma imagem/ })
    .dispatchEvent("drop", { dataTransfer: drop })

  await expect(page.getByText(/O conteúdo do arquivo não corresponde/)).toBeVisible()
})

test("modo não demonstrativo bloqueia administração sem inicializar dados", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4174/admin/menu")

  await expect(
    page.getByRole("heading", { name: "Administração indisponível" }),
  ).toBeVisible()

  await expect(
    page.getByRole("button", { name: "Novo produto", exact: true }),
  ).toHaveCount(0)

  expect(await page.evaluate(() => localStorage.length)).toBe(0)

  await page.goto("http://127.0.0.1:4174/")

  await expect(
    page.getByText(/Configure explicitamente o modo demonstração/),
  ).toBeVisible()

  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test("catálogo sem populares seleciona a primeira categoria existente", async ({
  page,
}) => {
  await page.goto("/admin/menu")
  await expect(page.getByRole("heading", { name: "Gestão do Cardápio" })).toBeVisible()

  await page.evaluate((key) => {
    const menu = JSON.parse(localStorage.getItem(key)!)

    menu.products.forEach((product: { popular: boolean }) => {
      product.popular = false
    })

    menu.revision++
    localStorage.setItem(key, JSON.stringify(menu))
  }, storageKey)

  await page.goto("/")

  await expect(
    page.getByRole("button", { name: "Mais vendidos", exact: true }),
  ).toHaveCount(0)

  await expect(
    page.getByRole("heading", { name: "Hambúrgueres", exact: true }),
  ).toBeVisible()

  await expect(
    page.getByRole("heading", { name: "Smash Clássico", exact: true }),
  ).toBeVisible()
})

test("imagem válida pode ser removida sem restaurar foto de exemplo", async ({
  page,
}) => {
  await page.goto("/admin/menu")

  await page.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()

  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 2

    canvas.getContext("2d")!.fillRect(0, 0, 2, 2)
    return canvas.toDataURL("image/png").split(",")[1]
  })

  await page.getByLabel("Foto do produto", { exact: true }).setInputFiles({
    name: "valid.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  })

  await expect(
    page.getByRole("img", { name: "Prévia: Foto do produto" }),
  ).toHaveAttribute("src", /^data:image\/png;base64,/)

  await page.getByRole("button", { name: "Salvar produto" }).click()
  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Smash Clássico", exact: true }) })
  const imageBounds = await card.locator(".management-image img").boundingBox()
  const detailBounds = await card.locator(".management-details").boundingBox()
  expect(imageBounds).not.toBeNull()
  expect(detailBounds!.y).toBeGreaterThanOrEqual(imageBounds!.y + imageBounds!.height - 1)
  await page.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()
  await page.getByRole("button", { name: "Remover imagem", exact: true }).click()

  await page.getByRole("button", { name: "Salvar produto" }).click()

  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()

  await page.reload()

  await page.getByRole("button", { name: "Editar Smash Clássico", exact: true }).click()

  await expect(page.getByRole("img", { name: "Prévia: Foto do produto" })).toHaveCount(0)
})
