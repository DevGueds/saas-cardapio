import {
  orderBalanceSchema,
  paymentSchema,
  reportOrderSchema,
  type ReportRange,
} from "@cardapio/contracts"
import { Failure, requireValid } from "@cardapio/domain/failure"
import { assertPaymentBalance, sumCents } from "@cardapio/domain/payments"
import type { Payment } from "../../../generated/prisma/client.js"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import type { PaymentDraft, PaymentsRepository } from "../application/ports.js"
import { orderEvent } from "../../../shared/infrastructure/order-event.js"

function view(row: Payment) {
  const parsed = paymentSchema.safeParse({
    id: row.id,
    orderId: row.orderId,
    amount: row.amount,
    method: row.method,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    recordedBy: row.recordedBy,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversedBy: row.reversedBy,
    reversalReason: row.reversalReason,
  })
  if (!parsed.success)
    throw new Failure("CORRUPT_DATA", "Registro financeiro inválido. Contate o suporte.")
  return parsed.data
}
const period = (range: ReportRange) => ({
  gte: new Date(range.from),
  lt: new Date(range.to),
})
const activity = (range: ReportRange) => ({
  OR: [{ createdAt: period(range) }, { reversedAt: period(range) }],
})
async function lockStore(tx: Transaction, scope: TenantScope) {
  await tx.$queryRaw`SELECT id FROM Restaurant WHERE id = ${scope.restaurantId} AND tenantId = ${scope.tenantId} FOR UPDATE`
}

export class PrismaPayments implements PaymentsRepository {
  constructor(private readonly db: Database) {}
  record(scope: TenantScope, draft: PaymentDraft) {
    return this.db.transaction(async (tx) => {
      await lockStore(tx, scope)
      const previous = await tx.payment.findUnique({
        where: {
          tenantId_restaurantId_requestHash: { ...scope, requestHash: draft.requestHash },
        },
      })
      if (previous) {
        if (previous.payloadHash !== draft.payloadHash)
          throw new Failure(
            "CONFLICT",
            "Esta tentativa já foi registrada com outros valores. Atualize o histórico.",
          )
        return view(previous)
      }
      if (draft.orderId) {
        // Serialize against order cancellation as well as concurrent receipts.
        await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${draft.orderId} AND tenantId = ${scope.tenantId} AND restaurantId = ${scope.restaurantId} FOR UPDATE`
        const order = await tx.order.findFirst({ where: { ...scope, id: draft.orderId } })
        if (!order) throw new Failure("NOT_FOUND", "Pedido não encontrado.")
        requireValid(
          order.status !== "CANCELLED",
          "Não é possível receber por um pedido cancelado.",
        )
        const paid = await tx.payment.aggregate({
          where: { ...scope, orderId: draft.orderId, reversedAt: null },
          _sum: { amount: true },
        })
        assertPaymentBalance(
          order.total,
          paid._sum.amount ?? 0,
          draft.amount,
          draft.expectedPaid,
        )
      }
      const { expectedPaid: _expected, now, ...data } = draft
      if (draft.orderId)
        await orderEvent(tx, scope, draft.orderId, "PAYMENT", "RECORDED", now)
      return view(
        await tx.payment.create({ data: { ...scope, ...data, createdAt: now } }),
      )
    })
  }
  reverse(scope: TenantScope, id: string, actor: string, reason: string, now: Date) {
    return this.db.transaction(async (tx) => {
      await lockStore(tx, scope)
      const row = await tx.payment.findFirst({ where: { ...scope, id } })
      if (!row) throw new Failure("NOT_FOUND", "Recebimento não encontrado.")
      if (row.reversedAt) return view(row)
      await tx.payment.updateMany({
        where: { ...scope, id, reversedAt: null },
        data: { reversedAt: now, reversedBy: actor, reversalReason: reason },
      })
      if (row.orderId)
        await orderEvent(tx, scope, row.orderId, "REVERSAL", "REVERSED", now)
      return view({ ...row, reversedAt: now, reversedBy: actor, reversalReason: reason })
    })
  }
  balance(scope: TenantScope, orderId: string) {
    return this.db.transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ...scope, id: orderId } })
      if (!order) throw new Failure("NOT_FOUND", "Pedido não encontrado.")
      const payments = (
        await tx.payment.findMany({
          where: { ...scope, orderId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
      ).map(view)
      const paid = sumCents(payments.filter((p) => !p.reversedAt).map((p) => p.amount))
      const result = orderBalanceSchema.safeParse({
        orderId,
        total: order.total,
        paid,
        outstanding: order.status === "CANCELLED" ? 0 : order.total - paid,
        cancelled: order.status === "CANCELLED",
        payments,
      })
      if (!result.success)
        throw new Failure(
          "CORRUPT_DATA",
          "O saldo deste pedido está inconsistente. Contate o suporte.",
        )
      return result.data
    })
  }
  list(scope: TenantScope, range: ReportRange, cursor?: string) {
    return this.db.transaction(async (tx) => {
      const previous = cursor
        ? await tx.payment.findFirst({
            where: { ...scope, id: cursor, ...activity(range) },
          })
        : null
      if (cursor && !previous)
        throw new Failure("NOT_FOUND", "Página indisponível. Atualize o histórico.")
      const rows = await tx.payment.findMany({
        where: {
          ...scope,
          ...activity(range),
          ...(previous
            ? {
                AND: [
                  {
                    OR: [
                      { createdAt: { lt: previous.createdAt } },
                      { createdAt: previous.createdAt, id: { lt: previous.id } },
                    ],
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 101,
      })
      return {
        items: rows.slice(0, 100).map(view),
        nextCursor: rows.length > 100 ? rows[99]!.id : null,
      }
    })
  }
  report(scope: TenantScope, range: ReportRange) {
    return this.db.transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { ...scope, createdAt: period(range) },
        take: 5001,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          createdAt: true,
          status: true,
          subtotal: true,
          discount: true,
          deliveryFee: true,
          total: true,
          fulfillment: true,
        },
      })
      const payments = await tx.payment.findMany({
        where: { ...scope, ...activity(range) },
        take: 5001,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
      requireValid(
        orders.length <= 5000 && payments.length <= 5000,
        "Este período contém mais de 5.000 registros. Divida o período para exportar todos os dados.",
      )
      const balances = orders.length
        ? await tx.payment.groupBy({
            by: ["orderId"],
            where: {
              ...scope,
              orderId: { in: orders.map((o) => o.id) },
              reversedAt: null,
            },
            _sum: { amount: true },
          })
        : []
      const paid = new Map(balances.map((p) => [p.orderId, p._sum.amount ?? 0]))
      return {
        orders: orders.map((o) => {
          const fulfillment = o.fulfillment as { mode?: string } | null
          const parsed = reportOrderSchema.safeParse({
            ...o,
            createdAt: o.createdAt.toISOString(),
            paid: paid.get(o.id) ?? 0,
            fulfillment: fulfillment?.mode ?? "DELIVERY",
          })
          if (
            !parsed.success ||
            parsed.data.paid > o.total ||
            o.subtotal + o.deliveryFee - o.discount !== o.total
          )
            throw new Failure(
              "CORRUPT_DATA",
              "Há um pedido com valores inconsistentes. Contate o suporte.",
            )
          return parsed.data
        }),
        payments: payments.map(view),
      }
    })
  }
}
