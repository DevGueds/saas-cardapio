import { orderSchema, type OrderStatus, type OrderView } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Order } from "../../../generated/prisma/client.js"
import type { Database } from "../../../shared/infrastructure/database.js"
import { readMenu } from "../../catalog/infrastructure/prisma-menu.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import type { OrderDraft, OrdersRepository } from "../application/ports.js"
import { assertOrderSnapshot, assertTransition } from "../domain/order.js"

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
  })

  if (!result.success)
    throw new Failure(
      "CORRUPT_DATA",
      "Pedido com dados inválidos. Contate o suporte com o código de diagnóstico.",
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

export class PrismaOrders implements OrdersRepository {
  constructor(private readonly db: Database) {}

  create(
    scope: TenantScope,
    identity: { idempotencyHash: string; payloadHash: string },
    prepare: (menu: MenuDocument) => OrderDraft,
  ) {
    return this.db.transaction(async (tx) => {
      // Lock da linha do restaurante compatível com PostgreSQL
      await tx.$queryRaw`SELECT "id" FROM "restaurants" WHERE "id" = ${scope.restaurantId}::uuid AND "tenantId" = ${scope.tenantId}::uuid FOR UPDATE`

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

      const draft = prepare(await readMenu(tx, scope))
      const { restaurantId: _restaurantId, ...order } = draft.order

      const saved = await tx.order.create({
        data: {
          ...scope,
          ...identity,
          ...order,
          createdAt: new Date(order.createdAt),
          checkoutRevision: draft.checkoutRevision,
          whatsappUrl: draft.whatsappUrl,
        },
      })

      return {
        orderId: saved.id,
        url: saved.whatsappUrl,
        revision: saved.checkoutRevision,
      }
    })
  }

  list(scope: TenantScope, cursor?: string) {
    return this.db.transaction(async (tx) => {
      const previous = cursor
        ? await tx.order.findFirst({ where: { ...scope, id: cursor } })
        : null

      if (cursor && !previous)
        throw new Failure(
          "NOT_FOUND",
          "Página de pedidos indisponível. Atualize a lista.",
        )

      const rows = await tx.order.findMany({
        where: {
          ...scope,
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
  ) {
    return this.db.transaction(async (tx) => {
      const row = await tx.order.findFirst({ where: { ...scope, id } })
      if (!row) throw new Failure("NOT_FOUND", "Pedido não encontrado.")
      view(row)
      assertTransition(row.status, status)

      const result = await tx.order.updateMany({
        where: { ...scope, id, revision: expectedRevision },
        data: { status, revision: { increment: 1 } },
      })

      if (result.count !== 1)
        throw new Failure(
          "CONFLICT",
          "Este pedido foi alterado. Atualize antes de continuar.",
        )

      return view({ ...row, status, revision: row.revision + 1 })
    })
  }
}