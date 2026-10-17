import { PrismaPg } from "@prisma/adapter-pg";
import { OrderStatus, PrismaClient, Role } from "@prisma/client";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando a carga de dados de teste (Seed)...");

  // 1. Limpeza em ordem de integridade referencial
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 2. Usuario lojista
  const userId = "00000000-0000-0000-0000-000000000001";
  const user = await prisma.user.create({
    data: {
      id: userId,
      name: "Dono da Burger Shop",
      email: "lojista@teste.com",
      passwordHash:
        "$argon2id$v=19$m=19456,t=2,p=1$mockhashfordev$mockhashfordevmockhash",
      active: true,
    },
  });

  // 3. Tenant (organizacao)
  const tenant = await prisma.tenant.create({
    data: {
      name: "Burger Shop Franquia",
      active: true,
    },
  });

  // 4. Vinculo de acesso (Membership)
  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      role: Role.OWNER,
      active: true,
    },
  });

  // 5. Loja Matriz
  const restaurant = await prisma.restaurant.create({
    data: {
      tenantId: tenant.id,
      slug: "burgershop-matriz",
      name: "Burger Shop - Matriz",
      description: "Hamburgueres artesanais de verdade.",
      whatsapp: "5511999999999",
      whatsappConfigured: true,
      address: "Rua dos Hamburgueres, 100 - Sao Paulo, SP",
      logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349",
      coverUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349",
      deliveryFee: 500,
      minOrder: 2000,
      eta: "30-45 min",
      isOpen: true,
    },
  });

  // 6. Categorias
  const catBurgers = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: "Hamburgueres",
      normalizedName: "hamburgueres",
    },
  });

  const catDrinks = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      name: "Bebidas",
      normalizedName: "bebidas",
    },
  });

  // 7. Produtos
  const product1 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      categoryId: catBurgers.id,
      name: "X-Burger Artesanal",
      description: "Pao brioche, hamburguer 180g e queijo prato cheddar.",
      price: 3200,
      imageUrl: "https://placehold.co/300x300.png",
      available: true,
      popular: true,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      categoryId: catDrinks.id,
      name: "Coca-Cola 350ml",
      description: "Lata trincando de gelada.",
      price: 700,
      imageUrl: "https://placehold.co/300x300.png",
      available: true,
      popular: false,
    },
  });

  // 8. Pedido de teste
  await prisma.order.create({
    data: {
      tenantId: tenant.id,
      restaurantId: restaurant.id,
      status: OrderStatus.NEW,
      customer: {
        name: "Carlos Silva",
        phone: "11988887777",
        address: "Rua das Flores, 123",
      },
      items: [
        {
          productId: product1.id,
          name: product1.name,
          price: product1.price,
          quantity: 2,
        },
        {
          productId: product2.id,
          name: product2.name,
          price: product2.price,
          quantity: 1,
        },
      ],
      subtotal: 7100,
      deliveryFee: 500,
      total: 7600,
      checkoutRevision: 1,
      whatsappUrl: "https://wa.me/5511999999999?text=Pedido",
      idempotencyHash: "test-hash-12345",
      payloadHash: "test-payload-67890",
    },
  });

  console.log("Carga de dados finalizada com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro durante a execucao do seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });