import { Failure } from "@cardapio/domain/failure"
import { parseMenuDocument, type MenuDocument } from "@cardapio/domain/menu-document"
import { normalizeName } from "@cardapio/domain/validation"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import type { MenuRepository } from "../application/ports.js"

export async function readMenu(
  tx: Transaction,
  scope: TenantScope,
): Promise<MenuDocument> {
  const row = await tx.restaurant.findFirst({
    where: { 
      id: scope.restaurantId, 
      tenantId: scope.tenantId, 
      tenant: { active: true } 
    },
    include: {
      categories: { orderBy: { name: "asc" } },
      products: { orderBy: { name: "asc" } },
    },
  })

  if (!row) {
    throw new Failure("NOT_FOUND", "Restaurante não encontrado ou tenant inativo.")
  }

  try {
    return parseMenuDocument(
      {
        schemaVersion: 1,
        revision: row.revision,
        restaurant: {
          id: row.id,
          tenantId: row.tenantId,
          slug: row.slug, // 👈 PROPRIEDADE ADICIONADA AQUI!
          name: row.name,
          description: row.description,
          whatsapp: row.whatsapp,
          whatsappConfigured: row.whatsappConfigured,
          address: row.address,
          logoUrl: row.logoUrl,
          coverUrl: row.coverUrl,
          deliveryFee: row.deliveryFee,
          minOrder: row.minOrder,
          eta: row.eta,
          isOpen: row.isOpen,
          revision: row.revision,
        },
        categories: row.categories.map((c) => ({
          id: c.id,
          tenantId: c.tenantId,
          restaurantId: c.restaurantId,
          name: c.name,
          normalizedName: c.normalizedName,
        })),
        products: row.products.map((p) => ({
          id: p.id,
          tenantId: p.tenantId,
          restaurantId: p.restaurantId,
          categoryId: p.categoryId,
          name: p.name,
          description: p.description,
          price: p.price,
          imageUrl: p.imageUrl,
          available: p.available,
          popular: p.popular,
        })),
      },
      scope.restaurantId,
    )
  } catch (err: any) {
    if (err && typeof err === "object" && "issues" in err) {
      console.error("❌ ERRO DE ZOD NO MENU:", JSON.stringify(err.issues, null, 2))
    } else if (err && typeof err === "object" && "fields" in err) {
      console.error("❌ CAMPOS INVÁLIDOS NO MENU:", JSON.stringify(err.fields, null, 2))
    } else {
      console.error("❌ OUTRO ERRO NO MENU:", err)
    }

    throw new Failure(
      "CORRUPT_DATA",
      "Os dados da loja precisam de revisão. Contate o suporte com o código de diagnóstico.",
      {},
      err?.message || "invalid_persisted_menu",
    )
  }
}

export class PrismaMenu implements MenuRepository {
  constructor(private readonly db: Database) {}

  async resolve(slug: string): Promise<TenantScope> {
    try {
      const store = await this.db.run((client) =>
        client.restaurant.findFirst({
          where: { 
            slug: slug,
            tenant: { active: true } 
          },
          select: { 
            id: true, 
            tenantId: true 
          },
        })
      )

      if (!store) {
        throw new Failure("NOT_FOUND", "Restaurante não encontrado.")
      }

      return { tenantId: store.tenantId, restaurantId: store.id }
    } catch (cause) {
      if (cause instanceof Failure) throw cause
      throw new Failure("NOT_FOUND", "Restaurante não encontrado.")
    }
  }

  async load(scope: TenantScope): Promise<MenuDocument> {
    return this.db.transaction((tx) => readMenu(tx, scope))
  }

  async commit(
    scope: TenantScope, 
    expectedRevision: number, 
    input: MenuDocument
  ): Promise<MenuDocument> {
    const next = parseMenuDocument(input, scope.restaurantId)
    return this.db.transaction(async (tx) => {
      const restaurant = next.restaurant
      const changed = await tx.restaurant.updateMany({
        where: {
          id: scope.restaurantId,
          tenantId: scope.tenantId,
          revision: expectedRevision,
          tenant: { active: true },
        },
        data: {
          name: restaurant.name,
          description: restaurant.description,
          address: restaurant.address,
          whatsapp: restaurant.whatsapp,
          whatsappConfigured: restaurant.whatsappConfigured,
          logoUrl: restaurant.logoUrl,
          coverUrl: restaurant.coverUrl,
          deliveryFee: restaurant.deliveryFee,
          minOrder: restaurant.minOrder,
          eta: restaurant.eta,
          isOpen: restaurant.isOpen,
          revision: { increment: 1 },
        },
      })

      if (changed.count !== 1)
        throw new Failure(
          "CONFLICT",
          "Outra pessoa alterou a loja. Atualize os dados antes de salvar.",
        )

      for (const category of next.categories) {
        await tx.category.upsert({
          where: { tenantId_restaurantId_id: { ...scope, id: category.id } },
          create: { ...scope, ...category, normalizedName: normalizeName(category.name) },
          update: { name: category.name, normalizedName: normalizeName(category.name) },
        })
      }

      await tx.product.deleteMany({
        where: { ...scope, id: { notIn: next.products.map((product) => product.id) } },
      })

      for (const product of next.products) {
        const { id, restaurantId: _restaurantId, ...data } = product
        await tx.product.upsert({
          where: { tenantId_restaurantId_id: { ...scope, id } },
          create: { ...scope, ...product },
          update: data,
        })
      }

      return readMenu(tx, scope)
    })
  }
}