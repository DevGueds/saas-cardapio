import { expect, test } from "@playwright/test"
import { currentLegalAcceptance } from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"

test("owners arrange categories with live drag feedback, save explicitly and publish price-ordered sections", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000)
  const suffix = randomUUID().slice(0, 8),
    slug = `category-order-${suffix}`
  const registration = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        name: "Pessoa Categorias",
        email: `${slug}@browser.example.test`,
        password: "M7!qR2@x",
        restaurantName: "Cozinha Ordenada",
        slug,
        legalAcceptance: currentLegalAcceptance,
      },
    })
  ).json()
  expect(registration.ok, JSON.stringify(registration.error)).toBe(true)
  await mkdir(".cache", { recursive: true })
  const filename = ".cache/settings-browser-users.json"
  let ids: string[] = []
  try {
    ids = JSON.parse(await readFile(filename, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await writeFile(filename, JSON.stringify([...ids, registration.value.user.id]))
  const store = (await (await page.request.get("/api/v1/me/restaurants")).json()).value[0]
  const path = `/api/v1/restaurants/${store.id}`,
    headers = { origin: baseURL!, "x-csrf-token": registration.value.csrfToken }
  let menu: MenuDocument = (await (await page.request.get(path + "/menu")).json()).value
  for (const name of ["Lanches", "Bebidas", "Sobremesas"]) {
    for (const [price, suffix] of [
      ["30,00", "especial"],
      ["8,00", "simples"],
    ]) {
      const category = menu.categories.find((category) => category.name === name)
      const result = await (
        await page.request.post(path + "/products", {
          headers,
          data: {
            expectedRevision: menu.revision,
            name: `${name} ${suffix}`,
            description: "Feito na hora.",
            price,
            categoryId: category?.id ?? "",
            ...(category ? {} : { newCategoryName: name }),
            imageUrl: "",
            available: true,
            popular: false,
          },
        })
      ).json()
      expect(result.ok, JSON.stringify(result.error)).toBe(true)
      menu = result.value
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/admin/menu?restaurant=${store.id}`)
  const consent = page.getByRole("button", { name: "Entendi", exact: true })
  if (await consent.isVisible()) await consent.click()
  await page.getByText("Categorias do cardápio", { exact: false }).click()
  const list = page.getByRole("list", { name: "Ordem das categorias no cardápio" }),
    names = list.locator(".category-order-row__name strong")
  await expect(names).toHaveText(["Lanches", "Bebidas", "Sobremesas"])
  let writes = 0
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/categories/order"))
      writes++
  })
  const source = (await page
    .getByRole("button", { name: "Arrastar categoria Lanches", exact: true })
    .boundingBox())!
  const destination = (await page
    .getByRole("button", { name: "Arrastar categoria Sobremesas", exact: true })
    .boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2 + 10)
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 12 },
  )
  await expect(page.locator(".category-drag-preview")).toContainText("Lanches")
  expect(writes).toBe(0)
  await page.screenshot({ path: ".cache/category-order-drag-desktop.png" })
  await page.mouse.up()
  await expect(names).toHaveText(["Bebidas", "Sobremesas", "Lanches"])
  await expect(page.getByText("Ordem alterada · ainda não publicada")).toBeVisible()
  expect(writes).toBe(0)
  await page.getByRole("button", { name: "Salvar ordem", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Ordem publicada no cardápio." }),
  ).toBeVisible()
  expect(writes).toBe(1)
  await page.reload()
  await page.getByText("Categorias do cardápio", { exact: false }).click()
  await expect(names).toHaveText(["Bebidas", "Sobremesas", "Lanches"])
  // Keyboard alternatives remain usable and Escape cancels an in-progress drag.
  const handle = page.getByRole("button", {
    name: "Arrastar categoria Bebidas",
    exact: true,
  })
  await handle.focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Escape")
  await expect(names).toHaveText(["Bebidas", "Sobremesas", "Lanches"])
  await expect(
    page.getByRole("button", { name: "Salvar ordem", exact: true }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 900 })
  await list.scrollIntoViewIfNeeded()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  })
  const touchStart = (await page
    .getByRole("button", { name: "Arrastar categoria Lanches", exact: true })
    .boundingBox())!
  const touchEnd = (await page
    .getByRole("button", { name: "Arrastar categoria Bebidas", exact: true })
    .boundingBox())!
  const x = touchStart.x + touchStart.width / 2,
    startY = touchStart.y + touchStart.height / 2,
    endY = touchEnd.y + touchEnd.height / 2
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  })
  for (let step = 1; step <= 12; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 12 }],
    })
  await expect(page.locator(".category-drag-preview")).toBeVisible()
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await cdp.detach()
  await expect(names).toHaveText(["Lanches", "Bebidas", "Sobremesas"])
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/category-order-mobile.png", fullPage: true })
  // Failed writes keep the preview and require an explicit retry.
  let failed = false
  await page.route(`**${path}/categories/order`, async (route) => {
    if (!failed) {
      failed = true
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "Conexão interrompida. Tente novamente.",
            fields: {},
            diagnosticId: "fixture-retry",
          },
        }),
      })
      return
    }
    await route.continue()
  })
  await page.getByRole("button", { name: "Salvar ordem", exact: true }).click()
  await expect(
    page.getByText("Conexão interrompida. Tente novamente.", { exact: true }),
  ).toBeVisible()
  await expect(names).toHaveText(["Lanches", "Bebidas", "Sobremesas"])
  expect(writes).toBe(2)
  await page.getByRole("button", { name: "Salvar ordem", exact: true }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Ordem publicada no cardápio." }),
  ).toBeVisible()
  expect(writes).toBe(3)
  await page.goto(`/menu/${slug}`)
  const nav = page.getByRole("navigation", { name: "Categorias do cardápio" })
  await expect(nav.getByRole("link")).toHaveText([
    "Todos",
    "Lanches",
    "Bebidas",
    "Sobremesas",
  ])
  await expect(
    page.getByRole("button", { name: "Menores preços", exact: true }),
  ).toHaveCount(0)
  for (const name of ["Lanches", "Bebidas", "Sobremesas"]) {
    const section = page.getByRole("region", { name, exact: true })
    await expect(section.locator(".product-card h3")).toHaveText([
      `${name} simples`,
      `${name} especial`,
    ])
  }
  await page.screenshot({
    path: ".cache/menu-category-prices-mobile.png",
    fullPage: true,
  })
})
