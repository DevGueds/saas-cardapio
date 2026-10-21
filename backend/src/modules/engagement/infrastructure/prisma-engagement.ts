import { randomUUID, createHash } from "node:crypto"
import { boardSnapshotSchema, deliveriesSchema, type Role } from "@cardapio/contracts"
import { can } from "@cardapio/domain/permissions"
import { Failure, requireValid } from "@cardapio/domain/failure"
import type { Database } from "../../../shared/infrastructure/database.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import type {
  EngagementRepository,
  ChannelRecord,
  PushInput,
} from "../application/ports.js"
import { notificationView } from "../application/messages.js"
import type { SubscriptionCipher } from "./subscription-cipher.js"
export class PrismaEngagement implements EngagementRepository {
  constructor(
    private readonly db: Database,
    private readonly cipher: SubscriptionCipher,
  ) {}
  async settings(scope: TenantScope): Promise<ChannelRecord> {
    return this.db.run(
      async (tx) =>
        (await tx.storeChannel.findFirst({ where: scope })) ?? {
          revision: 0,
          boardEnabled: false,
          boardVersion: scope.restaurantId,
          whatsappEnabled: false,
        },
    )
  }
  update(scope: TenantScope, revision: number, next: Omit<ChannelRecord, "revision">) {
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Restaurant WHERE id = ${scope.restaurantId} AND tenantId = ${scope.tenantId} FOR UPDATE`
      const old = await tx.storeChannel.findFirst({ where: scope })
      if ((old?.revision ?? 0) !== revision)
        throw new Failure(
          "CONFLICT",
          "As configurações mudaram. Atualize antes de salvar.",
        )
      return tx.storeChannel.upsert({
        where: { tenantId_restaurantId: scope },
        create: { ...scope, ...next, revision: 1 },
        update: { ...next, revision: { increment: 1 } },
      })
    })
  }
  board(scope: TenantScope) {
    return this.db.run(async (tx) => {
      const store = await tx.restaurant.findFirst({
        where: {
          id: scope.restaurantId,
          tenantId: scope.tenantId,
          tenant: { active: true },
        },
        select: { name: true },
      })
      if (!store) throw new Failure("NOT_FOUND", "Painel indisponível.")
      const orders = await tx.order.findMany({
        where: {
          ...scope,
          createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
          status: { in: ["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY"] },
        },
        select: { id: true, status: true, createdAt: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 501,
      })
      return boardSnapshotSchema.parse({
        name: store.name,
        truncated: orders.length > 500,
        orders: orders
          .slice(0, 500)
          .map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
      })
    })
  }
  orderAccess(scope: TenantScope, id: string, trackingHash: string, now: Date) {
    return this.db.run(async (tx) => {
      const row = await tx.order.findFirst({
        where: { ...scope, id, trackingHash, trackingExpiresAt: { gt: now } },
        select: { whatsappConsentAt: true, whatsappRevokedAt: true },
      })
      if (!row) throw new Failure("NOT_FOUND", "Pedido indisponível ou link expirado.")
      return { whatsapp: !!row.whatsappConsentAt && !row.whatsappRevokedAt }
    })
  }
  async consent(scope: TenantScope, id: string, consent: boolean, now: Date) {
    // Repeating the same preference must not invalidate events already authorized.
    // A new consent after revocation starts a fresh eligibility window.
    await this.db.run((tx) =>
      tx.order.updateMany({
        where: {
          ...scope,
          id,
          ...(consent
            ? {
                OR: [{ whatsappConsentAt: null }, { whatsappRevokedAt: { not: null } }],
              }
            : { whatsappRevokedAt: null }),
        },
        data: consent
          ? { whatsappConsentAt: now, whatsappRevokedAt: null }
          : { whatsappRevokedAt: now },
      }),
    )
  }
  async subscribe(
    scope: TenantScope,
    recipient: { userId: string; sessionId: string } | { orderId: string },
    input: PushInput | null,
    endpoint: string,
    now: Date,
  ) {
    const identity = "userId" in recipient ? { userId: recipient.userId } : recipient
    const endpointHash = createHash("sha256")
      .update(JSON.stringify(identity))
      .update(endpoint)
      .digest("hex")
    await this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Restaurant WHERE id = ${scope.restaurantId} AND tenantId = ${scope.tenantId} FOR UPDATE`
      if (!input) {
        await tx.pushSubscription.deleteMany({
          where: { ...scope, ...identity, endpointHash },
        })
        return
      }
      const old = await tx.pushSubscription.findFirst({
        where: { ...scope, ...identity, endpointHash },
      })
      if (!old)
        requireValid(
          (await tx.pushSubscription.count({ where: { ...scope, ...identity } })) < 10 &&
            (await tx.pushSubscription.count({ where: scope })) < 1000,
          "Limite de dispositivos atingido. Desative notificações de aparelhos antigos.",
        )
      const data = {
        ...("sessionId" in recipient ? { sessionId: recipient.sessionId } : {}),
        encrypted: this.cipher.seal(input),
        expiresAt: new Date(now.getTime() + 30 * 86400000),
      }
      await tx.pushSubscription.upsert({
        where: { tenantId_restaurantId_endpointHash: { ...scope, endpointHash } },
        create: {
          ...scope,
          ...recipient,
          ...data,
          endpointHash,
          id: randomUUID(),
          createdAt: now,
        },
        update: data,
      })
    })
  }
  inbox(scope: TenantScope, userId: string, role: Role) {
    return this.db.transaction(async (tx) => {
      const readAt =
        (
          await tx.inboxRead.findUnique({
            where: { tenantId_restaurantId_userId: { ...scope, userId } },
          })
        )?.readAt ?? new Date(0)
      const where = {
        ...scope,
        ...(!can(role, "payments:read") ? { kind: "ORDER" } : {}),
        ...(role === "COURIER" ? { order: { courierId: userId } } : {}),
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      }
      const items = await tx.notificationEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      })
      const unread = await tx.notificationEvent.count({
        where: { ...where, createdAt: { ...where.createdAt, gt: readAt } },
      })
      return { items: items.map(notificationView), unread, readAt: readAt.toISOString() }
    })
  }
  async read(scope: TenantScope, userId: string, before: Date) {
    await this.db.transaction(async (tx) => {
      const old = await tx.inboxRead.findUnique({
        where: { tenantId_restaurantId_userId: { ...scope, userId } },
      })
      if (old && old.readAt >= before) return
      await tx.inboxRead.upsert({
        where: { tenantId_restaurantId_userId: { ...scope, userId } },
        create: { ...scope, userId, readAt: before },
        update: { readAt: before },
      })
    })
  }
  deliveries(scope: TenantScope) {
    return this.db.run(async (tx) =>
      deliveriesSchema.parse(
        (
          await tx.notificationDelivery.findMany({
            where: { event: scope },
            include: { event: { select: { orderId: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        ).map((d) => ({
          id: d.id,
          orderId: d.event.orderId,
          channel: d.channel,
          state: d.state,
          attempts: d.attempts,
          createdAt: d.createdAt.toISOString(),
        })),
      ),
    )
  }
}
