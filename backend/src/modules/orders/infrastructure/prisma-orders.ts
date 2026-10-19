import { Failure, requireValid } from "@cardapio/domain/failure"
import { parseCommerce } from "@cardapio/domain/commerce"
import { orderSchema, type OrderView, type OrderStatus } from "@cardapio/contracts"
import type { Database } from "../../../shared/infrastructure/database.js"
import type { Order, Prisma } from "../../../generated/prisma/client.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import { readMenu } from "../../catalog/infrastructure/prisma-menu.js"
import { assertTransition, assertOrderSnapshot } from "../domain/order.js"
import type { OrderDraft, OrdersRepository, OrderOperator } from "../application/ports.js"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { orderEvent } from "../../../shared/infrastructure/order-event.js"
const json = (value: unknown) => value as Prisma.InputJsonValue
function view(row: Order): OrderView {
  const result = orderSchema.safeParse({
    id: row.id,
    restaurantId: row.restaurantId,
    revision: row.revision,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    customer: row.customer,
    subtotal: row.subtotal,
    deliveryFee: row.deliveryFee,
    total: row.total,
    items: row.items,
    discount: row.discount,
    promotionId: row.promotionId,
    promotionName: row.promotionName,
    fulfillment: row.fulfillment ?? { mode: "DELIVERY" },
    region: row.region,
    eta: row.eta,
    courierId: row.courierId,
    history: row.history ?? [{ status: row.status, at: row.updatedAt.toISOString() }],
  })
  if (!result.success)
    throw new Failure(
      "CORRUPT_DATA",
      "Pedido com dados inválidos. Contate o suporte.",
      {},
      "invalid_persisted_order",
    )
  try {
    assertOrderSnapshot(result.data)
  } catch {
    throw new Failure(
      "CORRUPT_DATA",
      "Pedido com valores inconsistentes. Contate o suporte.",
      {},
      "invalid_persisted_order_values",
    )
  }
  return result.data
}
function courierFilter(operator?: OrderOperator) {
  return operator?.role === "COURIER" ? { courierId: operator.userId } : {}
}
export class PrismaOrders implements OrdersRepository {
  constructor(private readonly db: Database) {}
  receipt(scope: TenantScope, idempotencyHash: string) {
    return this.db.run(async (tx) => {
      const row = await tx.order.findUnique({
        where: { tenantId_restaurantId_idempotencyHash: { ...scope, idempotencyHash } },
      })
      if (!row) return null
      view(row)
      return { orderId: row.id, revision: row.checkoutRevision, url: row.whatsappUrl }
    })
  }
  create(
    scope: TenantScope,
    identity: { idempotencyHash: string; payloadHash: string },
    prepare: (menu: MenuDocument) => OrderDraft,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Restaurant WHERE id = ${scope.restaurantId} AND tenantId = ${scope.tenantId} FOR UPDATE`
      const previous = await tx.order.findUnique({
        where: {
          tenantId_restaurantId_idempotencyHash: {
            ...scope,
            idempotencyHash: identity.idempotencyHash,
          },
        },
      })
      if (previous) {
        if (previous.payloadHash !== identity.payloadHash)
          throw new Failure(
            "CONFLICT",
            "Esta tentativa já foi usada com outros dados. Revise o pedido antes de enviar novamente.",
          )
        view(previous)
        return {
          orderId: previous.id,
          url: previous.whatsappUrl,
          revision: previous.checkoutRevision,
        }
      }
      const menu = await readMenu(tx, scope),
        draft = prepare(menu),
        { restaurantId: _restaurantId, ...order } = draft.order
      if (order.promotionId) {
        const commerce = parseCommerce(menu.commerce, menu.products)
        const promotion = commerce.promotions.find((p) => p.id === order.promotionId)
        requireValid(
          !!promotion && (!promotion.maxUses || promotion.used < promotion.maxUses),
          "Esta promoção atingiu seu limite. Revise o total.",
        )
        promotion!.used += 1
        await tx.storeCommerce.update({
          where: { tenantId_restaurantId: scope },
          data: { promotions: json(commerce.promotions) },
        })
      }
      const saved = await tx.order.create({
        data: {
          ...scope,
          ...identity,
          ...order,
          items: json(order.items),
          customer: json(order.customer),
          fulfillment: json(order.fulfillment),
          history: json(order.history),
          createdAt: new Date(order.createdAt),
          checkoutRevision: draft.checkoutRevision,
          whatsappUrl: draft.whatsappUrl,
          trackingHash: draft.trackingHash,
          trackingExpiresAt: draft.trackingExpiresAt,
          whatsappConsentAt: draft.whatsappConsentAt ?? null,
        },
      })
      await orderEvent(tx, scope, saved.id, "ORDER", "NEW", saved.createdAt)
      return {
        orderId: saved.id,
        url: saved.whatsappUrl,
        revision: saved.checkoutRevision,
      }
    })
  }
  list(scope: TenantScope, cursor?: string, operator?: OrderOperator) {
    return this.db.transaction(async (tx) => {
      const restriction = { ...scope, ...courierFilter(operator) }
      const previous = cursor
        ? await tx.order.findFirst({ where: { ...restriction, id: cursor } })
        : null
      if (cursor && !previous)
        throw new Failure(
          "NOT_FOUND",
          "Página de pedidos indisponível. Atualize a lista.",
        )
      const rows = await tx.order.findMany({
        where: {
          ...restriction,
          ...(previous
            ? {
                OR: [
                  { createdAt: { lt: previous.createdAt } },
                  { createdAt: previous.createdAt, id: { lt: previous.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      })
      return {
        items: rows.slice(0, 50).map(view),
        nextCursor: rows.length > 50 ? rows[49]!.id : null,
      }
    })
  }
  transition(
    scope: TenantScope,
    id: string,
    expectedRevision: number,
    status: OrderStatus,
    operator: OrderOperator,
    now: Date,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await tx.order.findFirst({
        where: { ...scope, id, ...courierFilter(operator) },
      })
      if (!row) throw new Failure("NOT_FOUND", "Pedido não encontrado.")
      const order = view(row)
      assertTransition(row.status, status)
      const pickup = order.fulfillment?.mode === "PICKUP"
      requireValid(
        !(pickup && status === "OUT_FOR_DELIVERY") &&
          !(status === "COMPLETED" && row.status === "READY" && !pickup),
        "Etapa incompatível com a modalidade do pedido.",
      )
      const history = [...order.history!, { status, at: now.toISOString() }]
      const result = await tx.order.updateMany({
        where: { ...scope, id, revision: expectedRevision, ...courierFilter(operator) },
        data: { status, history: json(history), revision: { increment: 1 } },
      })
      if (result.count !== 1)
        throw new Failure(
          "CONFLICT",
          "Este pedido foi alterado. Atualize antes de continuar.",
        )
      await orderEvent(tx, scope, id, "ORDER", status, now)
      return view({
        ...row,
        status,
        history: history as Prisma.JsonValue,
        revision: row.revision + 1,
      })
    })
  }
  assign(
    scope: TenantScope,
    id: string,
    expectedRevision: number,
    courierId: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await tx.order.findFirst({ where: { ...scope, id } })
      if (!row) throw new Failure("NOT_FOUND", "Pedido não encontrado.")
      const order = view(row)
      requireValid(
        order.fulfillment?.mode !== "PICKUP" &&
          ["NEW", "PREPARING", "READY"].includes(row.status),
        "Atribua o entregador antes da saída para entrega.",
      )
      if (courierId) {
        const member = await tx.membership.findFirst({
          where: {
            tenantId: scope.tenantId,
            userId: courierId,
            role: "COURIER",
            active: true,
            user: { active: true },
          },
        })
        requireValid(!!member, "Selecione um entregador ativo desta equipe.", "courierId")
      }
      const result = await tx.order.updateMany({
        where: { ...scope, id, revision: expectedRevision },
        data: { courierId, revision: { increment: 1 } },
      })
      if (result.count !== 1)
        throw new Failure(
          "CONFLICT",
          "O pedido mudou. Atualize antes de atribuir o entregador.",
        )
      return view({ ...row, courierId, revision: row.revision + 1 })
    })
  }
  couriers(scope: TenantScope) {
    return this.db.run(async (tx) =>
      (
        await tx.membership.findMany({
          where: {
            tenantId: scope.tenantId,
            role: "COURIER",
            active: true,
            user: { active: true },
          },
          select: { userId: true, user: { select: { name: true } } },
          take: 100,
        })
      ).map((m) => ({ userId: m.userId, name: m.user.name })),
    )
  }
  track(scope: TenantScope, id: string, trackingHash: string, now: Date) {
    return this.db.run(async (tx) => {
      const row = await tx.order.findFirst({
        where: { ...scope, id, trackingHash, trackingExpiresAt: { gt: now } },
        include: { restaurant: { select: { name: true } } },
      })
      if (!row)
        throw new Failure(
          "NOT_FOUND",
          "Acompanhamento indisponível ou expirado. Confira o link recebido.",
        )
      const {
        customer: _customer,
        courierId: _courier,
        promotionId: _promotion,
        ...order
      } = view(row)
      return {
        ...order,
        items: order.items.map((i) => ({ ...i, note: "" })),
        restaurantName: row.restaurant.name,
      }
    })
  }
}
