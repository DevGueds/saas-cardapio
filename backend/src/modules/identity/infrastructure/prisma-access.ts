import { Failure } from "@cardapio/domain/failure"
import type { Database } from "../../../shared/infrastructure/database.js"
import type { Actor } from "../domain/identity.js"
import type { AccessRepository, FirstStore } from "../application/ports.js"
import { createFirstStore, restaurantDefaults } from "./prisma-identity.js"

export class PrismaAccess implements AccessRepository {
  constructor(private readonly db: Database) {}
  membership(actor: Actor, tenantId: string) {
    return this.db.run(
      async (client) =>
        (
          await client.membership.findFirst({
            where: {
              tenantId,
              userId: actor.userId,
              active: true,
              tenant: { active: true },
            },
            select: { role: true },
          })
        )?.role ?? null,
    )
  }
  restaurantMembership(actor: Actor, restaurantId: string) {
    return this.db.run(async (client) => {
      const restaurant = await client.restaurant.findFirst({
        where: {
          id: restaurantId,
          tenant: {
            active: true,
            memberships: { some: { userId: actor.userId, active: true } },
          },
        },
        select: {
          id: true,
          tenantId: true,
          tenant: {
            select: {
              memberships: {
                where: { userId: actor.userId, active: true },
                select: { role: true },
              },
            },
          },
        },
      })
      const role = restaurant?.tenant.memberships[0]?.role
      return restaurant && role
        ? { scope: { tenantId: restaurant.tenantId, restaurantId: restaurant.id }, role }
        : null
    })
  }
  restaurants(actor: Actor) {
    return this.db.run(async (client) =>
      (
        await client.restaurant.findMany({
          where: {
            tenant: {
              active: true,
              memberships: { some: { userId: actor.userId, active: true } },
            },
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            slug: true,
            tenant: {
              select: {
                memberships: {
                  where: { userId: actor.userId, active: true },
                  select: { role: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 100,
        })
      ).flatMap((row) => {
        const role = row.tenant.memberships[0]?.role
        return role
          ? [{ id: row.id, tenantId: row.tenantId, name: row.name, slug: row.slug, role }]
          : []
      }),
    )
  }
  createTenant(actor: Actor, tenant: { id: string; name: string }, store: FirstStore) {
    return this.db.transaction((tx) => createFirstStore(tx, actor.userId, tenant, store))
  }
  createRestaurant(
    tenantId: string,
    restaurant: { id: string; name: string; slug: string },
  ) {
    return this.db.run(async (client) => {
      await client.restaurant.create({
        data: restaurantDefaults({ ...restaurant, tenantId }),
      })
    })
  }
  addMember(
    tenantId: string,
    email: string,
    role: Exclude<import("@cardapio/contracts").Role, "OWNER">,
  ) {
    return this.db.transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, active: true, emailVerifiedAt: true },
      })
      if (!user?.active)
        throw new Failure("NOT_FOUND", "Conta indisponível para associação.")
      if (!user.emailVerifiedAt)
        throw new Failure(
          "VALIDATION",
          "A pessoa precisa confirmar o e-mail antes de entrar na equipe.",
          {
            email:
              "Peça à pessoa para confirmar o e-mail na própria conta e tente novamente.",
          },
        )
      const previous = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
      })
      if (previous?.role === "OWNER")
        throw new Failure(
          "ACCESS_DENIED",
          "O vínculo do proprietário não pode ser alterado.",
        )
      await tx.membership.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        create: { tenantId, userId: user.id, role },
        update: { role, active: true },
      })
    })
  }
  removeMember(tenantId: string, userId: string) {
    return this.db.run(async (client) => {
      const result = await client.membership.updateMany({
        where: { tenantId, userId, role: { not: "OWNER" } },
        data: { active: false },
      })
      if (result.count !== 1)
        throw new Failure("ACCESS_DENIED", "Vínculo não encontrado ou protegido.")
    })
  }
  members(tenantId: string) {
    return this.db.run(async (client) =>
      (
        await client.membership.findMany({
          where: { tenantId, active: true },
          select: { userId: true, role: true, user: { select: { name: true } } },
        })
      ).map((row) => ({ userId: row.userId, role: row.role, name: row.user.name })),
    )
  }
}
