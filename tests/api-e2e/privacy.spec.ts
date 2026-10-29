import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { PNG } from "pngjs"

test("brand, legal modals and account privacy work on mobile with real persistence", async ({
  page,
}) => {
  const slug = `privacidade-${randomUUID().slice(0, 8)}`,
    password = "secure-passphrase"
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const outside: string[] = []
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url()))
      outside.push(request.url())
  })
  await page.goto("/login")
  await expect(page).toHaveTitle(/Pede Aqui/)
  await page.getByRole("button", { name: "Entendi", exact: true }).click()
  const trigger = page.getByRole("button", {
    name: "Privacidade",
    exact: true,
  })
  await trigger.click()
  const dialog = page.getByRole("dialog", {
    name: "Política de Privacidade",
    exact: true,
  })
  await expect(dialog).toContainText("66.369.962/0001-20")
  for (let step = 0; step < 7; step++) {
    await page.keyboard.press("Tab")
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
    ).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.getByRole("button", { name: "Primeiro acesso? Criar minha conta" }).click()
  await page.getByLabel("Seu nome *", { exact: true }).fill("Ana Privacidade")
  await page.getByLabel("E-mail *", { exact: true }).fill(`${slug}@browser.example.test`)
  await page.getByLabel("Senha *", { exact: true }).fill(password)
  await page.getByLabel("Nome da loja *", { exact: true }).fill("Loja Privacidade")
  await page.getByLabel("Endereço do cardápio *", { exact: true }).fill(slug)
  const acceptance = page.getByRole("checkbox", { name: /Li e aceito/ })
  await expect(acceptance).not.toBeChecked()
  let submissions = 0
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/register") && request.method() === "POST")
      submissions++
  })
  await page.getByRole("button", { name: "Criar conta e loja", exact: true }).click()
  expect(submissions).toBe(0)
  await expect(acceptance).toHaveAttribute("aria-invalid", "true")
  await acceptance.check()
  const registered = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/register") && response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Criar conta e loja", exact: true }).click()
  const account = await (await registered).json()
  expect(account.ok).toBe(true)
  await mkdir(".cache", { recursive: true })
  await writeFile(
    ".cache/privacy-browser-users.json",
    JSON.stringify([account.value.user.id]),
  )
  await page.waitForURL(/\/admin/)
  await page.goto("/privacidade")
  await expect(page.getByText("Ana Privacidade", { exact: true })).toBeVisible()
  await expect(page.getByText(/Documentos atuais lidos e aceitos/)).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.getByLabel("Confirme sua senha atual *", { exact: true }).fill("incorrect")
  await page.getByRole("button", { name: "Preparar minha cópia", exact: true }).click()
  await expect(page.getByText(/A senha atual não confere. Revise/)).toBeVisible()
  await expect(page.getByText("Ana Privacidade", { exact: true })).toBeVisible()
  await page.getByLabel("Confirme sua senha atual *", { exact: true }).fill(password)
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Preparar minha cópia", exact: true }).click()
  const file = await download
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"))
  expect(exported.account.id).toBe(account.value.user.id)
  expect(JSON.stringify(exported)).not.toMatch(
    /passwordHash|tokenHash|csrfToken|totpSecret/,
  )
  await page
    .getByLabel("O que você precisa? *", { exact: true })
    .selectOption("INFORMATION")
  await page
    .getByLabel("Detalhes do pedido", { exact: true })
    .fill("Quais fornecedores tratam meus dados?")
  await page.getByRole("button", { name: "Registrar solicitação", exact: true }).click()
  await expect(
    page.getByRole("listitem").filter({ hasText: "Informações sobre o tratamento" }),
  ).toContainText("Recebida")
  await page.reload()
  await expect(
    page.getByRole("listitem").filter({ hasText: "Informações sobre o tratamento" }),
  ).toContainText("Protocolo")
  expect(outside).toEqual([])
  await page.screenshot({ path: ".cache/privacy-mobile.png", fullPage: true })
  const image = await page.request.get("/brand/og-pede-aqui.png")
  expect(image.status()).toBe(200)
  expect(image.headers()["content-type"]).toMatch(/image\/png/)
  const png = PNG.sync.read(await image.body())
  expect([png.width, png.height]).toEqual([600, 600])
  const html = await (await page.request.get("/")).text()
  expect(html).toContain('property="og:image" content="/brand/og-pede-aqui.png"')
  expect(html).toContain('property="og:image:width" content="600"')
})
