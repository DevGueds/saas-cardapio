import "dotenv/config"
import { readFile } from "node:fs/promises"
import { loadConfig } from "../dist/app/config.js"
import { Database } from "../dist/shared/infrastructure/database.js"

const database = process.env.TEST_DATABASE_URL
if (!database || (!new URL(database).pathname.endsWith("_test") && !database.includes("_test")))
  throw new Error("Somente banco _test pode receber limpeza de testes.")

const ids = JSON.parse(
  await readFile(new URL("../../.cache/api-browser-users.json", import.meta.url), "utf8"),
)

if (
  !Array.isArray(ids) ||
  !ids.every((id) => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id))
)
  throw new Error("Identificadores de teste inválidos.")

const db = new Database(
  loadConfig({ ...process.env, NODE_ENV: "test", DATABASE_URL: database }),
)

try {
  await db.transaction(async (tx) => {
    // Busca perfis de teste gerados pelos testes E2E do navegador
    const profiles = await tx.profile.findMany({
      where: { id: { in: ids }, email: { endsWith: "@browser.example.test" } },
      select: { id: true },
    })
    const userId = { in: profiles.map((p) => p.id) }

    const memberships = await tx.membership.findMany({
      where: { userId, role: "OWNER" },
      select: { tenantId: true },
    })
    const tenantId = { in: memberships.map((row) => row.tenantId) }

    // Limpeza sequencial para evitar Foreign Key Violations no Postgres
    await tx.order.deleteMany({ where: { tenantId } })
    await tx.product.deleteMany({ where: { tenantId } })
    await tx.category.deleteMany({ where: { tenantId } })
    await tx.restaurant.deleteMany({ where: { tenantId } })
    await tx.membership.deleteMany({ where: { tenantId } })
    await tx.tenant.deleteMany({ where: { id: tenantId } })
    await tx.profile.deleteMany({ where: { id: userId } })
  })
} finally {
  await db.close()
}