import { currentLegalAcceptance } from "@cardapio/contracts"
import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { mkdir, writeFile } from "node:fs/promises"
const { generate } = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("otplib") as { generate(options: { secret: string }): Promise<string> }

test("MFA guides enrollment, mobile recovery, login and per-person management exceptions", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180000)
  const suffix = randomUUID().slice(0, 8),
    email = `mfa-browser-${suffix}@browser.example.test`,
    password = "secure-test-passphrase"
  const registered = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        legalAcceptance: currentLegalAcceptance,
        name: "Gestora Segurança",
        email,
        password,
        restaurantName: "Loja Segurança",
        slug: `seguranca-${suffix}`,
      },
    })
  ).json()
  expect(registered.ok, registered.error?.code).toBe(true)
  const stores = await (await page.request.get("/api/v1/me/restaurants")).json(),
    store = stores.value[0]
  const staff = await browser.newContext(),
    staffPage = await staff.newPage()
  const staffEmail = `mfa-team-${suffix}@browser.example.test`
  const staffAccount = await (
    await staff.request.post(`${baseURL}/api/v1/auth/register-account`, {
      headers: { origin: baseURL! },
      data: {
        legalAcceptance: currentLegalAcceptance,
        name: "Pessoa da Cozinha",
        email: staffEmail,
        password,
      },
    })
  ).json()
  expect(staffAccount.ok, staffAccount.error?.code).toBe(true)
  const added = await (
    await page.request.post(`/api/v1/tenants/${store.tenantId}/members`, {
      headers: { origin: baseURL!, "x-csrf-token": registered.value.csrfToken },
      data: { email: staffEmail, role: "KITCHEN" },
    })
  ).json()
  expect(added.ok).toBe(true)
  await mkdir(".cache", { recursive: true })
  await writeFile(
    ".cache/mfa-browser-users.json",
    JSON.stringify([registered.value.user.id, staffAccount.value.user.id]),
  )
  await page.goto("/mfa")
  await page.getByLabel("Sua senha atual", { exact: true }).fill(password)
  await page
    .getByRole("button", { name: "Configurar aplicativo autenticador", exact: true })
    .click()
  const secret = await page
    .getByLabel("Chave para cadastro manual", { exact: true })
    .inputValue()
  await expect(
    page.getByAltText("QR Code para configurar seu aplicativo autenticador"),
  ).toBeVisible()
  await page
    .getByLabel("Código do aplicativo", { exact: true })
    .fill(await generate({ secret }))
  await page.getByRole("button", { name: "Ativar proteção", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Guarde seus códigos de recuperação" }),
  ).toBeVisible()
  const codes = await page.locator(".recovery-codes code").allTextContents()
  expect(codes).toHaveLength(10)
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  // Recovery secrets must never be persisted in local/session storage.
  const browserStorage = await page.evaluate(() =>
    JSON.stringify([localStorage, sessionStorage]),
  )
  expect(codes.some((code) => browserStorage.includes(code))).toBe(false)
  await page.getByLabel("Guardei meus códigos em um local seguro").check()
  await page.getByRole("button", { name: "Continuar para minhas lojas" }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/admin/security?restaurant=${store.id}`)
  await page
    .getByRole("button", { name: "Exigir para toda a equipe", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByLabel("Sua senha atual", { exact: true })
    .fill(password)
  await page
    .getByRole("button", { name: "Confirmar regra de segurança", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Retirar exigência geral", exact: true }),
  ).toBeEnabled()
  await staffPage.goto(`${baseURL}/admin`)
  await expect(staffPage).toHaveURL(/\/mfa$/)
  await expect(
    staffPage.getByText("Sua loja exige uma segunda etapa", { exact: false }),
  ).toBeVisible()
  await page
    .getByLabel("Exigência para Pessoa da Cozinha", { exact: true })
    .selectOption("EXEMPT")
  await page
    .getByRole("dialog")
    .getByLabel("Sua senha atual", { exact: true })
    .fill(password)
  await page
    .getByRole("button", { name: "Confirmar regra de segurança", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    page.getByLabel("Exigência para Pessoa da Cozinha", { exact: true }),
  ).toHaveValue("EXEMPT")
  await staffPage.goto(`${baseURL}/admin`)
  await expect(
    staffPage.getByRole("heading", { name: "Qual loja vamos cuidar hoje?" }),
  ).toBeVisible()
  await page.goto("/mfa")
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click()
  await page.getByLabel("E-mail *", { exact: true }).fill(email)
  await page.getByLabel("Senha *", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar na minha conta", exact: true }).click()
  await expect(page).toHaveURL(/\/mfa$/)
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.getByRole("heading", { name: "Confirme seu acesso" })).toBeVisible()
  await page.screenshot({ path: ".cache/mfa-login-mobile.png", fullPage: true })
  await page
    .getByLabel("Código do aplicativo ou de recuperação", { exact: true })
    .fill(codes[0]!)
  await page.getByRole("button", { name: "Confirmar e entrar", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Qual loja vamos cuidar hoje?" }),
  ).toBeVisible()
  await staff.close()
})
