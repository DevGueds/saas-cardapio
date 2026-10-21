import type { Page } from "@playwright/test"
export async function fillDeliveryAddress(
  page: Page,
  street = "Rua São João",
  number = "10",
  region = true,
) {
  await page.getByLabel("Rua, avenida ou estrada").fill(street)
  await page.getByLabel("Número do imóvel").fill(number)
  if (region) {
    await page.getByLabel("Bairro do endereço").fill("Centro")
    await page.getByLabel("Cidade do endereço").fill("São Paulo")
    await page.getByLabel("UF do endereço").selectOption("SP")
  }
}
