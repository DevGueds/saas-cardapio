import "dotenv/config"
import { randomUUID } from "node:crypto"
import { Database } from "../dist/shared/infrastructure/database.js"
import { loadConfig } from "../dist/app/config.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Only the _test database is allowed")
const db = new Database(
  loadConfig({ ...process.env, NODE_ENV: "test", DATABASE_URL: database }),
)
const slug = "benchmark-local"
try {
  await db.transaction(async (tx) => {
    if (await tx.restaurant.findUnique({ where: { slug } })) return
    const tenantId = randomUUID(),
      restaurantId = randomUUID(),
      categoryId = randomUUID()
    await tx.tenant.create({ data: { id: tenantId, name: "Synthetic benchmark" } })
    await tx.restaurant.create({
      data: {
        id: restaurantId,
        tenantId,
        slug,
        name: "Cardápio de carga sintética",
        description: "Fixture local: 20 produtos sem imagens.",
        whatsapp: "",
        address: "",
        logoUrl: "",
        coverUrl: "",
        eta: "30–45 min",
        isOpen: true,
      },
    })
    await tx.category.create({
      data: {
        id: categoryId,
        tenantId,
        restaurantId,
        name: "Produtos de teste",
        normalizedName: "produtos de teste",
      },
    })
    await tx.product.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        id: randomUUID(),
        tenantId,
        restaurantId,
        categoryId,
        name: `Produto ${i + 1}`,
        description: "Descrição de produto para medição reproduzível.",
        price: 2500 + i * 100,
        imageUrl: "",
      })),
    })
  })
  console.log(
    "Fixture disponível: /api/v1/public/restaurants/benchmark-local/menu (somente _test)",
  )
} finally {
  await db.close()
}
