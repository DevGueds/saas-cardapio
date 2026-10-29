import { expect, test, type Page } from "@playwright/test"

test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\//, (route) => route.abort())
})

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
}

test("pedidos têm filtros, busca e transições acessíveis sem perder a simulação", async ({
  page,
}) => {
  await page.goto("/admin/orders")
  await expect(page.getByRole("heading", { name: "Gestor de Pedidos" })).toBeVisible()
  await expect(
    page.getByText("Experimente à vontade. Este quadro é uma simulação."),
  ).toBeVisible()
  const incoming = page.getByRole("region", { name: "Novos pedidos", exact: true })
  const preparing = page.getByRole("region", { name: "Em preparo", exact: true })
  const delivery = page.getByRole("region", { name: "Saiu para entrega", exact: true })
  const card = page.getByRole("article", { name: "Pedido #1048", exact: true })
  await expect(incoming.getByRole("article")).toHaveCount(3)
  await card.getByRole("button", { name: "Iniciar preparo" }).focus()
  await page.keyboard.press("Enter")
  await expect(
    preparing.getByRole("article", { name: "Pedido #1048", exact: true }),
  ).toBeVisible()
  await expect(card).toBeFocused()
  await expect(incoming.getByRole("article")).toHaveCount(2)
  await card.getByRole("button", { name: "Enviar para entrega" }).click()
  await expect(
    delivery.getByRole("article", { name: "Pedido #1048", exact: true }),
  ).toBeVisible()
  await expect(card.getByText("Em rota de entrega")).toBeVisible()
  await page.getByRole("button", { name: /^Saiu para entrega/ }).click()
  await expect(
    page.getByRole("region", { name: "Novos pedidos", exact: true }),
  ).toHaveCount(0)
  await page.getByLabel("Buscar pedidos").fill("Mariana")
  await expect(page.getByRole("article")).toHaveCount(1)
  await expect(
    card.getByRole("button", { name: "Contato indisponível na demonstração" }),
  ).toBeDisabled()
  await page.getByLabel("Buscar pedidos").fill("Não existe")
  await expect(page.getByText("Nenhum resultado")).toBeVisible()
  await page.getByRole("link", { name: "Configurações", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Configurações da loja" })).toBeVisible()
  await page.getByRole("link", { name: "Pedidos demonstrativos", exact: true }).click()
  await expect(
    incoming.getByRole("article", { name: "Pedido #1048", exact: true }),
  ).toBeVisible()
})

test("menu móvel contém o foco, fecha com Escape e mantém a navegação", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin/menu")
  const trigger = page.getByRole("button", { name: "Abrir menu", exact: true })
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Navegação da loja" })
  await expect(dialog).toBeVisible()
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab")
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(
      true,
    )
  }
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Shift+Tab")
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(
      true,
    )
  }
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole("link", { name: "Configurações", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Configurações da loja" })).toBeVisible()
  await noPageOverflow(page)
})

for (const width of [320, 768, 1280]) {
  test(`telas preservam leitura e navegação em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const [route, heading] of [
      ["/admin/orders", "Gestor de Pedidos"],
      ["/admin/settings", "Configurações da loja"],
      ["/admin/menu", "Gestão do Cardápio"],
      ["/menu/burger-house", "Burger House"],
    ]) {
      await page.goto(route)
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible()
      await noPageOverflow(page)
    }
    await page
      .getByRole("button", { name: "Adicionar Smash Clássico", exact: true })
      .click()
    const add = page.getByRole("button", {
      name: "Adicionar uma unidade de Smash Clássico",
      exact: true,
    })
    const box = await add.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole("button", { name: "Abrir carrinho com 1 item" }).click()
    await expect(page.getByRole("dialog", { name: "Seu carrinho" })).toBeVisible()
    await noPageOverflow(page)
  })
}

test("busca e visualização de catálogo mantêm ações e limpam filtros sem apagar dados", async ({
  page,
}) => {
  await page.goto("/admin/menu")
  await page.getByLabel("Buscar produtos").fill("Produto inexistente")
  await expect(page.getByText("Nenhum produto encontrado")).toBeVisible()
  await page.getByRole("button", { name: "Limpar filtros" }).click()
  await expect(
    page.getByRole("heading", { name: "Smash Clássico", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Exibir tabela" }).click()
  await expect(page.getByRole("table").first()).toBeVisible()
  await page.getByRole("button", { name: "Pausar Smash Clássico", exact: true }).click()
  await expect(page.getByText("Disponibilidade salva.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Disponibilizar Smash Clássico", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Exibir cards" }).click()
  await page
    .getByRole("button", { name: "Disponibilizar Smash Clássico", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Pausar Smash Clássico", exact: true }),
  ).toBeVisible()
})

test("configurações mantêm campos visíveis ao navegar por teclado e salvam no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin/settings")
  const phone = page.getByLabel("WhatsApp da loja com DDD")
  await phone.fill("11999998888")
  await page.keyboard.press("Tab")
  await expect(page.getByLabel("Prazo de entrega *")).toBeFocused()
  // Keyboard focus scrolls smoothly; assert visibility after scrolling settles.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const element = document.activeElement as HTMLElement
        const bounds = element.getBoundingClientRect()
        const centerX = bounds.x + bounds.width / 2
        const centerY = bounds.y + bounds.height / 2
        return (
          centerY >= 0 &&
          centerY < innerHeight &&
          element.contains(document.elementFromPoint(centerX, centerY))
        )
      }),
    )
    .toBe(true)
  await page.getByRole("button", { name: "Salvar configurações" }).click()
  await expect(page.getByText("Configurações salvas.")).toBeVisible()
  await page.reload()
  await expect(phone).toHaveValue("+55 (11) 99999-8888")
})

for (const width of [320, 390, 768]) {
  test(`menu móvel mantém contraste e formato de gaveta em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/admin/delivery")
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Navegação da loja" })
    await expect(dialog).toHaveCSS("background-color", "rgb(18, 62, 52)")
    await expect(dialog).toHaveCSS("color", "rgb(244, 247, 239)")
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBe(0)
    expect(bounds!.y).toBe(0)
    expect(bounds!.width).toBeLessThanOrEqual(320)
    expect(bounds!.height).toBe(844)
    const contrasts = await dialog.evaluate((root) => {
      function rgb(value: string) {
        return value
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
      }
      function luminance(color: number[]) {
        return color
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i]!, 0)
      }
      return [
        ...root.querySelectorAll(
          ".dialog-heading h2, .restaurant-switcher strong, .restaurant-switcher small, .nav-section-label, .admin-nav a > span",
        ),
      ].map((element) => {
        let parent: Element | null = element
        let background = "rgb(23, 47, 39)"
        while (parent) {
          const candidate = getComputedStyle(parent).backgroundColor
          if (candidate !== "rgba(0, 0, 0, 0)" && candidate !== "transparent") {
            background = candidate
            break
          }
          parent = parent.parentElement
        }
        const fore = luminance(rgb(getComputedStyle(element).color)),
          back = luminance(rgb(background))
        return (Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05)
      })
    })
    expect(contrasts.length).toBeGreaterThan(6)
    for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5)
    if (width === 390)
      await page.screenshot({ path: ".cache/mobile-navigation-contrast.png" })
    await dialog.getByRole("link", { name: "Configurações", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Configurações da loja" }),
    ).toBeVisible()
  })
}
