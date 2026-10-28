import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { PNG } from "pngjs"

test("impressão configura Bluetooth, editor, logo e gera PDF/ESC-POS com recebimento e reversão", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route(/https:\/\//, (route) => route.abort())
  const slug = `impressao-${randomUUID().slice(0, 8)}`
  const registered = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        name: "Gestora Impressão",
        email: `${slug}@browser.example.test`,
        password: "test-passphrase-123",
        restaurantName: "Loja Impressão",
        slug,
      },
    })
  ).json()
  expect(registered.ok, registered.error?.code).toBe(true)
  await mkdir(".cache", { recursive: true })
  await writeFile(
    ".cache/printing-browser-users.json",
    JSON.stringify([registered.value.user.id]),
  )
  const stores = await (await page.request.get("/api/v1/me/restaurants")).json(),
    store = stores.value[0]
  const headers = { origin: baseURL!, "x-csrf-token": registered.value.csrfToken }
  await page.goto(`/admin/printing?restaurant=${store.id}`)
  // Mirrors the production font/script policy: no scripts or external content in the receipt.
  await page.evaluate(() => {
    const meta = document.createElement("meta")
    meta.httpEquiv = "Content-Security-Policy"
    meta.content =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'"
    document.head.append(meta)
  })
  await expect(
    page.locator(".printing-page input:visible, .printing-page select:visible"),
  ).toHaveCount(0)
  const printers = page.getByRole("tab", { name: "Impressoras", exact: true })
  await printers.focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("tab", { name: "Comprovantes", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(printers).toBeFocused()
  const add = page.getByRole("button", { name: "Adicionar impressora", exact: true })
  await add.click()
  await page.getByLabel("Nome da impressora", { exact: true }).fill("Rascunho cancelado")
  await page.keyboard.press("Escape")
  await expect(add).toBeFocused()
  await expect(page.getByText("Rascunho cancelado", { exact: true })).toHaveCount(0)
  await add.click()
  await page.getByLabel("Modelo e papel").selectOption("generic-58")
  await page.getByLabel("Nome da impressora", { exact: true }).fill("Minha Bluetooth")
  await page
    .getByRole("dialog", { name: "Adicionar impressora", exact: true })
    .getByRole("button", { name: "Adicionar", exact: true })
    .click()
  await page.getByRole("tab", { name: "Comprovantes", exact: true }).click()
  await page.getByRole("button", { name: /^Layout e logo/ }).click()
  await expect(
    page.getByRole("button", { name: "Adicionar bloco", exact: true }),
  ).toBeEnabled()
  await page.getByLabel("Novo bloco", { exact: true }).selectOption("text")
  await page.getByRole("button", { name: "Adicionar bloco", exact: true }).click()
  const text = page.getByLabel("Texto (até 500 caracteres)", { exact: true }).last()
  await text.fill("Obrigado & volte sempre!")
  const logo = new PNG({ width: 40, height: 24 })
  for (let i = 0; i < logo.data.length; i += 4) {
    logo.data[i] = 16
    logo.data[i + 1] = 90
    logo.data[i + 2] = 70
    logo.data[i + 3] = 255
  }
  await page.getByLabel("Enviar logo", { exact: true }).setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(logo),
  })
  await expect(page.getByAltText("Logo usado nos comprovantes")).toBeVisible()
  const save = page.getByRole("button", { name: "Salvar alterações", exact: true })
  await expect(save).toBeEnabled()
  await text.fill("<img src=x onerror=alert(1)>")
  await expect(save).toBeDisabled()
  await page.getByRole("button", { name: /^Cozinha/ }).click()
  await expect(
    page.getByRole("button", { name: "Adicionar bloco", exact: true }),
  ).toBeEnabled()
  await expect(save).toBeDisabled()
  await page.getByRole("tab", { name: "Impressoras", exact: true }).click()
  await expect(save).toBeDisabled()
  await page.getByRole("tab", { name: "Comprovantes", exact: true }).click()
  await page.getByRole("button", { name: /^Pedido/ }).click()
  await expect(text).toHaveValue("<img src=x onerror=alert(1)>")
  await text.fill("Obrigado & volte sempre!")
  await expect(save).toBeEnabled()
  await page
    .getByLabel("Impressora padrão")
    .selectOption({ label: "Minha Bluetooth · 58 mm" })
  await page.getByRole("button", { name: "Testar impressão", exact: true }).click()
  const preview = page.getByRole("dialog", {
    name: "Teste de impressão — dados fictícios",
    exact: true,
  })
  const receipt = preview.frameLocator("iframe")
  await expect(receipt.locator("body")).toContainText("NÃO FISCAL")
  await expect(receipt.locator("body")).toContainText("TESTE")
  await expect(receipt.locator("body")).toContainText("Obrigado & volte sempre!")
  await expect(receipt.locator("svg image")).toHaveCount(1)
  await preview
    .getByRole("button", { name: "Imprimir pelo sistema", exact: true })
    .isEnabled()
  const download = page.waitForEvent("download")
  await preview.getByRole("button", { name: "Baixar PDF", exact: true }).click()
  await (await download).saveAs(".cache/printing-58.pdf")
  expect((await readFile(".cache/printing-58.pdf")).subarray(0, 5).toString()).toBe(
    "%PDF-",
  )
  await preview.getByText("Opções avançadas de impressão", { exact: true }).click()
  await preview
    .getByRole("button", { name: "Gerar arquivo ESC/POS", exact: true })
    .click()
  const binary = page.waitForEvent("download")
  await page
    .getByRole("button", {
      name: "Compatibilidade conferida, gerar arquivo",
      exact: true,
    })
    .click()
  await (await binary).saveAs(".cache/printing-58.bin")
  const bytes = await readFile(".cache/printing-58.bin")
  expect(bytes.length).toBeGreaterThan(500)
  expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]))
  await preview.getByRole("button", { name: "Fechar", exact: true }).click()
  await save.click()
  await page
    .getByRole("dialog", { name: "Salvar configuração da loja?" })
    .getByRole("button", { name: "Confirmar", exact: true })
    .click()
  await expect(
    page.getByText("Configurações de impressão salvas para a loja."),
  ).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Ajustar Minha Bluetooth", exact: true }).click()
  await expect(page.getByLabel("Nome da impressora", { exact: true })).toHaveValue(
    "Minha Bluetooth",
  )
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto"
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path: ".cache/printing-settings-desktop.png", fullPage: true })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/printing-settings-mobile.png", fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  const payment = await (
    await page.request.post(`/api/v1/restaurants/${store.id}/payments`, {
      headers,
      data: {
        requestId: randomUUID(),
        orderId: null,
        expectedPaid: 0,
        amount: "10,01",
        method: "PIX",
        description: "Venda de teste impressão",
      },
    })
  ).json()
  expect(payment.ok, payment.error?.code).toBe(true)
  await page.goto(`/admin/finance?restaurant=${store.id}`)
  await page.getByRole("button", { name: "Comprovante", exact: true }).click()
  const paymentDialog = page.getByRole("dialog", {
    name: "Comprovante de recebimento",
    exact: true,
  })
  const paymentReceipt = paymentDialog.frameLocator("iframe")
  await expect(paymentReceipt.locator("body")).toContainText("10,01")
  await expect
    .poll(async () =>
      (await paymentReceipt.locator("svg text").allTextContents()).join(" "),
    )
    .toContain("Registro manual; não é confirmação bancária.")
  const reversed = await (
    await page.request.post(
      `/api/v1/restaurants/${store.id}/payments/${payment.value.id}/reverse`,
      { headers, data: { reason: "Correção para teste do comprovante" } },
    )
  ).json()
  expect(reversed.ok).toBe(true)
  await paymentDialog
    .getByRole("button", { name: "Atualizar situação registrada", exact: true })
    .click()
  await expect(paymentReceipt.locator("body")).toContainText("RECEBIMENTO REVERTIDO")
  await expect(paymentReceipt.locator("body")).toContainText("não comprova devolução")
  await paymentDialog
    .getByLabel("Perfil de impressão")
    .selectOption({ label: "Impressora A4 · 210 mm" })
  await expect(paymentReceipt.locator("svg").first()).toHaveAttribute("width", "210mm")
  await page.screenshot({ path: ".cache/printing-reversed-a4.png", fullPage: true })
  // A network failure must hide the previous printable snapshot until a successful reload.
  await page.route("**/payments/*/document", (route) => route.abort())
  await paymentDialog
    .getByRole("button", { name: "Atualizar situação registrada", exact: true })
    .click()
  await expect(paymentDialog.getByRole("alert")).toBeVisible()
  await expect(
    paymentDialog.getByRole("button", { name: "Baixar PDF", exact: true }),
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

test("impressão simplifica ajustes no celular, preserva cancelamento e substitui os padrões ao remover", async ({
  page,
  baseURL,
}) => {
  const slug = `ux-impressao-${randomUUID().slice(0, 8)}`
  const registered = await (
    await page.request.post("/api/v1/auth/register", {
      headers: { origin: baseURL! },
      data: {
        name: "Gestora UX",
        email: `${slug}@browser.example.test`,
        password: "test-passphrase-123",
        restaurantName: "Loja UX",
        slug,
      },
    })
  ).json()
  expect(registered.ok).toBe(true)
  const records = JSON.parse(
    await readFile(".cache/printing-browser-users.json", "utf8").catch(() => "[]"),
  ) as string[]
  await writeFile(
    ".cache/printing-browser-users.json",
    JSON.stringify([...new Set([...records, registered.value.user.id])]),
  )
  const stores = await (await page.request.get("/api/v1/me/restaurants")).json(),
    store = stores.value[0]
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/admin/printing?restaurant=${store.id}`)
  await expect(
    page.getByRole("button", { name: "Adicionar impressora", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Ajustar Térmica 80 mm", exact: true }).click()
  const adjust = page.getByRole("dialog", { name: "Ajustar impressora", exact: true })
  await expect(adjust.getByLabel("Largura útil (mm)", { exact: true })).toBeHidden()
  await adjust
    .getByLabel("Nome da impressora", { exact: true })
    .fill("Rascunho que será cancelado")
  await adjust.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Ajustar Térmica 80 mm", exact: true }),
  ).toBeFocused()
  await expect(
    page.getByRole("button", { name: "Salvar alterações", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Ajustar Térmica 80 mm", exact: true }).click()
  await adjust.getByText("Ajustes avançados", { exact: true }).click()
  await adjust.getByLabel("Largura útil (mm)", { exact: true }).fill("209")
  await expect(
    adjust.getByRole("button", { name: "Aplicar ajustes", exact: true }),
  ).toBeDisabled()
  await expect(adjust.getByRole("alert")).toContainText("devem caber no papel")
  expect(
    await adjust.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true)
  await adjust.getByLabel("Largura útil (mm)", { exact: true }).fill("72")
  await adjust.getByRole("button", { name: "Remover impressora", exact: true }).click()
  const remove = page.getByRole("dialog", { name: "Remover impressora?", exact: true })
  await remove.getByLabel("Usar no lugar").selectOption("office-a4")
  await remove.getByRole("button", { name: "Remover", exact: true }).click()
  await page.getByRole("tab", { name: "Comprovantes", exact: true }).click()
  for (const name of ["Pedido", "Cozinha", "Entrega", "Recebimento"]) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.getByLabel("Impressora padrão")).toHaveValue("office-a4")
  }
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click()
  await page
    .getByRole("dialog", { name: "Salvar configuração da loja?", exact: true })
    .getByRole("button", { name: "Confirmar", exact: true })
    .click()
  await expect(
    page.getByText("Configurações de impressão salvas para a loja."),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Ajustar Térmica 80 mm", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("tab", { name: "Comprovantes", exact: true }).click()
  for (const name of ["Pedido", "Cozinha", "Entrega", "Recebimento"]) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.getByLabel("Impressora padrão")).toHaveValue("office-a4")
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto"
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path: ".cache/printing-receipts-mobile.png", fullPage: true })
})
