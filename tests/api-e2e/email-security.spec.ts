import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
const mailpit = "http://127.0.0.1:8025"
async function deliveredCode(email: string) {
  const response = await fetch(
    `${mailpit}/api/v1/search?query=${encodeURIComponent("to:" + email)}`,
  )
  expect(response.ok).toBe(true)
  const inbox = await response.json()
  expect(inbox.messages.length).toBeGreaterThan(0)
  const message = await (
    await fetch(`${mailpit}/api/v1/message/${inbox.messages[0].ID}`)
  ).json()
  const code = String(message.Text).match(/\b\d{6}\b/)?.[0]
  expect(code).toMatch(/^\d{6}$/)
  return code!
}
test("mobile signup shows strength, confirms passwords, defers email and verifies a real local message", async ({
  page,
}) => {
  const email = `seguranca-${randomUUID().slice(0, 8)}@browser.example.test`,
    password = "M7!qR2@x"
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/login?equipe=1")
  const consent = page.getByRole("button", { name: "Entendi", exact: true })
  if (await consent.isVisible()) await consent.click()
  await page.getByLabel("Seu nome *", { exact: true }).fill("Pessoa Segurança")
  await page.getByLabel("E-mail *", { exact: true }).fill(email)
  await page.getByLabel("Senha *", { exact: true }).fill("12345678")
  await page.getByLabel("Confirme a senha *", { exact: true }).fill("12345678")
  await expect(page.getByText("Fraca", { exact: true })).toBeVisible()
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check()
  await page
    .getByRole("button", { name: "Criar minha conta de equipe", exact: true })
    .click()
  await expect(page.getByLabel("Senha *", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  )
  await page.getByLabel("Senha *", { exact: true }).fill(password)
  await expect(page.getByText("Média", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "Criar minha conta de equipe", exact: true })
    .click()
  await expect(page.getByLabel("Confirme a senha *", { exact: true })).toBeFocused()
  await page.getByLabel("Confirme a senha *", { exact: true }).fill(password)
  await expect(page.getByText("As senhas coincidem.")).toBeVisible()
  await page.getByRole("button", { name: "Mostrar senhas" }).click()
  await expect(page.getByLabel("Senha *", { exact: true })).toHaveAttribute(
    "type",
    "text",
  )
  await page.getByRole("button", { name: "Ocultar senhas" }).click()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await mkdir(".cache", { recursive: true })
  await page.screenshot({ path: ".cache/security-signup-mobile.png", fullPage: true })
  const registered = page.waitForResponse(
    (r) => r.url().endsWith("/auth/register-account") && r.request().method() === "POST",
  )
  await page
    .getByRole("button", { name: "Criar minha conta de equipe", exact: true })
    .click()
  const account = await (await registered).json()
  expect(account.ok, account.error?.code).toBe(true)
  let known: string[] = []
  try {
    known = JSON.parse(await readFile(".cache/email-security-browser-users.json", "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await writeFile(
    ".cache/email-security-browser-users.json",
    JSON.stringify([...known, account.value.user.id]),
  )
  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail", exact: true }),
  ).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Novo código em/ })).toBeDisabled()
  await page.getByRole("link", { name: "Confirmar depois e acessar o app" }).click()
  await expect(page.getByText(/Sua conta ainda não tem lojas/)).toBeVisible()
  await page.getByRole("link", { name: "Confirmar e-mail", exact: true }).click()
  const code = await deliveredCode(email)
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0")
  await page.getByLabel("Código de confirmação *", { exact: true }).fill(wrong)
  await page.getByRole("button", { name: "Confirmar meu e-mail", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Código inválido")
  await expect(page.getByLabel("Código de confirmação *", { exact: true })).toHaveValue(
    wrong,
  )
  await page.getByLabel("Código de confirmação *", { exact: true }).fill(code)
  await page.getByRole("button", { name: "Confirmar meu e-mail", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "E-mail confirmado!", exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: ".cache/security-email-mobile.png", fullPage: true })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "E-mail confirmado!", exact: true }),
  ).toBeVisible()
  await page.getByRole("link", { name: "Continuar para o app", exact: true }).click()
  await expect(
    page.getByRole("complementary", { name: "Confirmação de e-mail pendente" }),
  ).toHaveCount(0)
})
