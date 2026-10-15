import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"

test("proxy encaminha API, mantém headers e nega acessos sem autorização", async ({
  request,
}) => {
  expect((await request.get("/api/v1/health/ready")).status()).toBe(200)
  const shell = await request.get("/admin/orders")
  expect(shell.status()).toBe(200)
  expect(shell.headers()["content-security-policy"]).toContain("script-src 'self'")
  expect(shell.headers()["x-frame-options"]).toBe("DENY")
  const privateResponse = await request.get("/api/v1/me/restaurants")
  expect(privateResponse.status()).toBe(401)
  expect(privateResponse.headers()["cache-control"]).toBe("no-store")
  expect((await privateResponse.json()).error.code).toBe("UNAUTHENTICATED")
  const crossOrigin = await request.post("/api/v1/auth/login", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  })
  expect(crossOrigin.status()).toBe(403)
  expect((await crossOrigin.json()).error.code).toBe("ACCESS_DENIED")
  expect((await request.get("/api/v1/openapi.json")).status()).toBe(404)
})

test("bundle Docker carrega, autentica pela API e preserva leitura no celular", async ({
  page,
}) => {
  const runtimeErrors: string[] = []
  page.on("pageerror", (error) => runtimeErrors.push(error.name))
  await page.route(/https:\/\//, (route) => route.abort())
  await page.goto("/admin/orders")
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui" })).toBeVisible()
  await page
    .getByLabel("E-mail *", { exact: true })
    .fill(`missing-${randomUUID()}@docker.example.test`)
  await page.getByLabel("Senha *", { exact: true }).fill("12345678")
  await page.getByRole("button", { name: "Entrar na minha conta", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos.")
  await expect(page.getByLabel("Senha *", { exact: true })).toHaveValue("12345678")
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true)
  await page.screenshot({ path: ".cache/docker-login-mobile.png", fullPage: true })
  await page.goto("/menu/loja-inexistente-docker")
  await expect(page.getByRole("alert")).toContainText("Restaurante não encontrado")
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  expect(runtimeErrors).toEqual([])
})
