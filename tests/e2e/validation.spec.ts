import { expect, test } from "@playwright/test"
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\//, (route) => route.abort())
})
test("validação orienta, preserva rascunho e formata sem apagar acentos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/admin")
  await page.getByRole("button", { name: "Novo produto", exact: true }).click()
  await page
    .getByLabel("Nome do produto *", { exact: true })
    .fill("  Açaí da Conceição  ")
  await page.getByLabel("Preço de venda *", { exact: true }).fill("1,23abc")
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
  const price = page.getByLabel("Preço de venda *", { exact: true })
  await expect(price).toBeFocused()
  await expect(price).toHaveAttribute("aria-invalid", "true")
  await expect(price).toHaveAccessibleDescription(/até 2 casas/)
  await expect(page.getByText("Produto salvo com sucesso.")).toHaveCount(0)
  await page.screenshot({ path: ".cache/validation-mobile.png", fullPage: false })
  await page.reload()
  await expect(price).toHaveValue("1,23abc")
  await expect(page.getByLabel("Nome do produto *", { exact: true })).toHaveValue(
    "Açaí da Conceição",
  )
  await price.fill("28.90")
  await price.press("Tab")
  await expect(price).toHaveValue("28,90")
  await page.getByRole("button", { name: "Salvar produto", exact: true }).click()
  await expect(page.getByText("Produto salvo com sucesso.")).toBeVisible()
})
test("telefone inválido não salva e máscara é preservada no recarregamento", async ({
  page,
}) => {
  await page.goto("/admin/settings")
  const phone = page.getByLabel("WhatsApp da loja com DDD", { exact: true })
  await phone.fill("20987654321")
  await page.getByRole("button", { name: "Salvar configurações" }).click()
  await expect(phone).toBeFocused()
  await expect(phone).toHaveAccessibleDescription(/DDD brasileiro válido/)
  await expect(page.getByText("Configurações salvas.")).toHaveCount(0)
  await phone.fill("11987654321")
  await phone.press("Tab")
  await expect(phone).toHaveValue("(11) 98765-4321")
  await page.getByRole("button", { name: "Salvar configurações" }).click()
  await expect(page.getByText("Configurações salvas.")).toBeVisible()
  await page.reload()
  await expect(phone).toHaveValue("+55 (11) 98765-4321")
})
