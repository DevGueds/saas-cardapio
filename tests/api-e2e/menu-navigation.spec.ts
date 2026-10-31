import { expect, test, type Request } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { currentLegalAcceptance } from "@cardapio/contracts"
import type { MenuDocument } from "@cardapio/domain/menu-document"

test("category anchors, isolated extras, product associations and responsive management screens", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(480000)
  const suffix = randomUUID().slice(0, 8),
    slug = `navigation-${suffix}`
  const registered = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        name: "Gestora Navegação",
        email: `navigation-${suffix}@browser.example.test`,
        password: "M7!qR2@x",
        restaurantName: "Lanches da Vila",
        slug,
        legalAcceptance: currentLegalAcceptance,
      },
    })
  ).json()
  expect(registered.ok, registered.error?.message).toBe(true)
  await mkdir(".cache", { recursive: true })
  const filename = ".cache/settings-browser-users.json"
  let users: string[] = []
  try {
    users = JSON.parse(await readFile(filename, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await writeFile(filename, JSON.stringify([...users, registered.value.user.id]))
  const store = (await (await page.request.get("/api/v1/me/restaurants")).json()).value[0]
  const route = `/api/v1/restaurants/${store.id}`,
    headers = { origin: baseURL!, "x-csrf-token": registered.value.csrfToken }
  let menu: MenuDocument = (await (await page.request.get(route + "/menu")).json()).value
  async function mutate(path: string, data: object, method: "post" | "put" = "put") {
    const response = await page.request[method](route + path, {
      headers,
      data: { expectedRevision: menu.revision, ...data },
    })
    const result = await response.json()
    expect(result.ok, JSON.stringify(result.error)).toBe(true)
    menu = result.value
  }
  for (const category of ["Lanches", "Bebidas", "Sobremesas"]) {
    for (let index = 1; index <= 4; index++) {
      const existing = menu.categories.find((entry) => entry.name === category)
      await mutate(
        "/products",
        {
          name: `${category} ${index}`,
          price: "20,00",
          description: "Feito na hora com ingredientes selecionados.",
          categoryId: existing?.id ?? "",
          ...(existing ? {} : { newCategoryName: category }),
          imageUrl: "",
          available: true,
          popular: false,
        },
        "post",
      )
    }
  }
  const burger = menu.products.find((entry) => entry.name === "Lanches 1")!,
    other = menu.products.find((entry) => entry.name === "Lanches 2")!,
    drink = menu.products.find((entry) => entry.name === "Bebidas 1")!
  const sauceId = randomUUID(),
    iceId = randomUUID()
  await mutate("/addons", {
    group: {
      id: sauceId,
      name: "Escolha seu molho",
      active: true,
      min: 1,
      max: 1,
      productIds: [burger.id],
      options: ["Maionese", "Barbecue"].map((name) => ({
        id: randomUUID(),
        name,
        price: 100,
        available: true,
        maxQuantity: 1,
      })),
    },
  })
  await mutate("/addons", {
    group: {
      id: iceId,
      name: "Gelo da bebida",
      active: true,
      min: 0,
      max: 2,
      productIds: [drink.id],
      options: [
        {
          id: randomUUID(),
          name: "Gelo extra",
          price: 200,
          available: true,
          maxQuantity: 2,
        },
      ],
    },
  })
  await mutate("/hours", {
    schedule: {
      enabled: false,
      timeZone: "America/Sao_Paulo",
      weekly: Array.from({ length: 7 }, () => [{ opensAt: "18:00", closesAt: "23:00" }]),
      exceptions: [],
    },
  })
  await mutate("/open", { isOpen: true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/menu/${slug}`)
  const consent = page.getByRole("button", { name: "Entendi", exact: true })
  if (await consent.isVisible()) await consent.click()
  const nav = page.getByRole("navigation", { name: "Categorias do cardápio" })
  await expect(page.locator(".product-card")).toHaveCount(12)
  await nav.getByRole("link", { name: "Bebidas", exact: true }).click()
  await expect(page).toHaveURL(/#categoria-/)
  await expect(nav.getByRole("link", { name: "Bebidas", exact: true })).toHaveAttribute(
    "aria-current",
    "location",
  )
  await expect(page.locator(".product-card")).toHaveCount(12)
  await expect(page.getByRole("heading", { name: "Lanches 1", exact: true })).toHaveCount(
    1,
  )
  const lastCategory = menu.categories.find((entry) => entry.name === "Sobremesas")!
  await page
    .locator(`#categoria-${lastCategory.id}`)
    .evaluate((element) => element.scrollIntoView())
  await expect(
    nav.getByRole("link", { name: "Sobremesas", exact: true }),
  ).toHaveAttribute("aria-current", "location")
  await page.goto("about:blank")
  await page.goto(
    `/menu/${slug}#categoria-${menu.categories.find((entry) => entry.name === "Bebidas")!.id}`,
  )
  await expect(page.locator(".product-card")).toHaveCount(12)
  await expect(nav.getByRole("link", { name: "Bebidas", exact: true })).toHaveAttribute(
    "aria-current",
    "location",
  )
  await page.getByRole("button", { name: "Adicionar Lanches 1", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Escolha seu molho", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Gelo da bebida", { exact: true })).toHaveCount(0)
  const add = dialog.getByRole("button", { name: "Adicionar ao carrinho", exact: true })
  await expect(add).toBeDisabled()
  await dialog.getByRole("radio", { name: "Maionese", exact: true }).check()
  await dialog.getByRole("radio", { name: "Barbecue", exact: true }).check()
  await expect(
    dialog.getByRole("radio", { name: "Maionese", exact: true }),
  ).not.toBeChecked()
  await dialog.getByRole("button", { name: "Aumentar quantidade do produto" }).click()
  await expect(add).toContainText("42,00")
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/menu-addons-320.png", fullPage: true })
  await add.click()
  await expect(
    page.getByRole("button", { name: "Abrir carrinho com 2 itens" }),
  ).toBeVisible()
  const otherCard = page
    .locator(".product-card")
    .filter({ has: page.getByRole("heading", { name: "Lanches 2", exact: true }) })
  await expect(otherCard.getByRole("button", { name: /Personalizar/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Adicionar Bebidas 1", exact: true }).click()
  await expect(dialog.getByText("Escolha seu molho", { exact: true })).toHaveCount(0)
  await dialog.getByRole("button", { name: "Adicionar Gelo extra", exact: true }).click()
  await expect(
    dialog.getByRole("button", { name: "Adicionar ao carrinho", exact: true }),
  ).toContainText("22,00")
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click()
  await page.goto(`/admin/menu?restaurant=${store.id}`)
  await page.getByRole("button", { name: "Editar Lanches 1", exact: true }).click()
  await page.getByText("Adicionais deste produto", { exact: true }).click()
  await page.getByRole("checkbox", { name: "Escolha seu molho", exact: true }).uncheck()
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  menu = (await (await page.request.get(route + "/menu")).json()).value
  expect(
    menu.commerce?.addonGroups?.find((group) => group.id === sauceId)?.productIds,
  ).toEqual([])
  expect(
    menu.commerce?.addonGroups?.find((group) => group.id === iceId)?.productIds,
  ).toEqual([drink.id])
  // API association changes are atomic with product updates and retain unrelated links.
  await mutate(`/products/${other.id}`, {
    name: other.name,
    description: other.description,
    categoryId: other.categoryId,
    imageUrl: other.imageUrl,
    available: other.available,
    popular: other.popular,
    price: "20,00",
    addonGroupIds: [sauceId],
  })
  await page.goto(`/menu/${slug}`)
  await expect(
    page.getByRole("button", { name: "Adicionar Lanches 1", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Adicionar Lanches 2", exact: true }),
  ).toHaveCount(1)
  await page.getByLabel("Buscar no cardápio").fill("Sobremesas")
  await expect(page.locator(".product-card")).toHaveCount(4)
  await nav.getByRole("link", { name: "Lanches", exact: true }).click()
  await expect(page.locator(".product-card")).toHaveCount(12)
  await page.goto(`/admin/hours?restaurant=${store.id}`)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const opening = page.getByLabel("Abertura Segunda-feira, faixa 1", { exact: true }),
    closing = page.getByLabel("Fechamento Segunda-feira, faixa 1", { exact: true })
  await expect(opening).toBeVisible()
  const openBox = (await opening.boundingBox())!,
    closeBox = (await closing.boundingBox())!
  expect(closeBox.x - openBox.x - openBox.width).toBeLessThan(80)
  expect(closeBox.y).toBe(openBox.y)
  await page.screenshot({ path: ".cache/hours-compact-desktop.png", fullPage: true })
  const routes = [
    "analytics",
    "menu",
    "orders",
    "settings",
    "hours",
    "printing",
    "security",
    "sharing",
    "channels",
    "addons",
    "appearance",
    "offers",
    "delivery",
    "team",
    "finance",
  ]
  const pending = new Set<Request>()
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !request.url().includes("/stream"))
      pending.add(request)
  })
  page.on("requestfinished", (request) => pending.delete(request))
  page.on("requestfailed", (request) => pending.delete(request))
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of routes) {
      await page.goto(`/admin/${path}?restaurant=${store.id}`)
      await expect(page.locator("main h1")).toBeVisible()
      await expect(page.getByText(/^Carregando /)).toHaveCount(0)
      await expect.poll(() => pending.size).toBe(0)
      await expect(
        page.getByText("A resposta da API não pôde ser validada.", { exact: false }),
      ).toHaveCount(0)
      await expect(page.locator("main .error-notice")).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} at ${width}px`,
      ).toBe(true)
      await page.screenshot({
        path: `.cache/review-${path}-${width}.png`,
        fullPage: true,
      })
    }
  }
})
