import { expect, test, type Page } from "@playwright/test"
import { expectReadableText } from "../browser-contrast"

test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\//, (route) => route.abort())
})
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)

test("dashboard navigation, instructions and selected controls keep readable contrast", async ({
  page,
}) => {
  test.setTimeout(120000)
  for (const route of [
    "menu",
    "analytics",
    "orders",
    "hours",
    "settings",
    "addons",
    "offers",
    "sharing",
    "appearance",
  ]) {
    await page.goto(`/admin/${route}`)
    await expect(page.locator(".admin-main h1")).toBeVisible()
    await expectReadableText(
      page.locator(
        ".admin-nav a,.page-description,.field-help,.eyebrow,.analytics-periods button,.analytics-segmented button,.view-toggle button,.order-filters button,.offer-tabs button,.sharing-networks button",
      ),
    )
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/admin/menu")
  await page.getByRole("button", { name: "Novo produto", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  expect(
    await dialog.evaluate((element) => getComputedStyle(element).backdropFilter),
  ).toBe("none")
  await expectReadableText(dialog.locator(".field-help,.form-intro"))
  await noOverflow(page)
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Novo produto", exact: true }),
  ).toBeFocused()
  const media = await page.context().newCDPSession(page)
  await media.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator(".admin-topbar")).toHaveCSS("backdrop-filter", "none")
  await expect(page.locator(".catalog-toolbar")).toHaveCSS("background-image", "none")
  await media.detach()
})

test("mobile shortcuts keep navigation, focus and touch targets accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto("/admin/analytics")
  const shortcuts = page.getByRole("navigation", { name: "Atalhos da loja" })
  await expect(shortcuts).toBeVisible()
  await expect(
    shortcuts.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  for (const control of await shortcuts.locator("a,button").all()) {
    const bounds = (await control.boundingBox())!
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
  await shortcuts.getByRole("link", { name: "Cardápio", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Gestão do Cardápio", exact: true }),
  ).toBeVisible()
  const more = shortcuts.getByRole("button", { name: "Mais opções da loja" })
  await more.click()
  await expect(page.getByRole("dialog", { name: "Navegação da loja" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(more).toBeFocused()
  await more.click()
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Horários da loja", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Horários da loja", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await noOverflow(page)
})

test("menu presets, store colors, pictures and cart survive the new design", async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [preset, color] of [
    ["CLASSIC", "GREEN"],
    ["EDITORIAL", "BLUE"],
    ["COMPACT", "PLUM"],
    ["CLASSIC", "ORANGE"],
  ]) {
    await page.goto("/admin/appearance")
    await page.getByLabel("Modelo do cardápio", { exact: true }).selectOption(preset)
    await page.getByLabel("Cor de destaque", { exact: true }).selectOption(color)
    await page.getByLabel("Exibir fotos dos produtos", { exact: true }).check()
    const publish = page.getByRole("button", { name: "Publicar aparência", exact: true })
    await publish.click()
    await expect(publish).toBeEnabled()
    await page.goto("/menu/burger-house")
    await expect(
      page.locator(
        `.menu-theme--${preset.toLowerCase()}.menu-color--${color.toLowerCase()}`,
      ),
    ).toBeVisible()
    const card = page
      .locator(".product-card")
      .filter({ has: page.getByRole("heading", { name: "Smash Clássico", exact: true }) })
    await expect(card.locator(".product-card__media")).toBeVisible()
    await card
      .getByRole("button", { name: /^Adicionar (?:uma unidade de )?Smash Clássico$/ })
      .click()
    await page.getByRole("button", { name: /Abrir carrinho com \d+ ite/ }).click()
    await expect(page.getByRole("dialog", { name: "Seu carrinho" })).toBeVisible()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Smash Clássico", exact: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await noOverflow(page)
  }
  await page.goto("/admin/appearance")
  await page.getByLabel("Exibir fotos dos produtos", { exact: true }).uncheck()
  await page.getByRole("button", { name: "Publicar aparência", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Publicar aparência", exact: true }),
  ).toBeEnabled()
  await page.goto("/menu/burger-house")
  await expect(page.locator(".menu-without-images")).toBeVisible()
  await expect(page.locator(".product-card__media").first()).toBeHidden()
  await noOverflow(page)
})

for (const width of [320, 1440])
  test(`secondary screens and product editor remain usable at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 900 })
    for (const [route, title] of [
      ["addons", "Adicionais e extras"],
      ["offers", "Combos e promoções"],
      ["appearance", "Aparência e QR Code"],
      ["delivery", "Entregas e retirada"],
      ["sharing", "Compartilhar cardápio"],
    ]) {
      await page.goto(`/admin/${route}`)
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
      await noOverflow(page)
    }
    await page.goto("/admin/menu")
    await page.getByRole("button", { name: "Novo produto", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await noOverflow(page)
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", { name: "Novo produto", exact: true }),
    ).toBeFocused()
  })

test("the interface loads one local variable font and reduces glass effects on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin/analytics")
  await expect(
    page.getByRole("heading", { name: "Dashboard de desempenho", exact: true }),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const fonts = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((path) => path.startsWith("/fonts/") && /\.(woff2?|ttf)$/.test(path)),
  )
  expect(fonts).toEqual(["/fonts/Plus-Jakarta-Sans-Latin.woff2"])
  expect(
    await page
      .locator(".admin-topbar")
      .evaluate((element) => getComputedStyle(element).backdropFilter),
  ).toBe("none")
})

test("form boundaries stay readable and validation keeps its error emphasis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin/settings")
  const phone = page.getByLabel("WhatsApp da loja com DDD")
  const contrast = await phone.evaluate((element) => {
    const luminance = (value: string) =>
      value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!,
          0,
        )
    const style = getComputedStyle(element),
      a = luminance(style.borderTopColor),
      b = luminance(style.backgroundColor)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(3)
  await phone.fill("123")
  await page.getByRole("button", { name: "Salvar configurações", exact: true }).click()
  await expect(phone).toHaveAttribute("aria-invalid", "true")
  await expect(phone).toHaveCSS("border-top-color", "rgb(180, 35, 56)")
})
