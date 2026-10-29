import { validLogoStructure } from "./png-logo.js"
import { lockRestaurant } from "../../../shared/infrastructure/row-locks.js"
import {
  orderSchema,
  paymentSchema,
  printingSettingsSchema,
  type PrintingSettings,
  type ReceiptKind,
  type Role,
  type UpdatePrintingSettings,
} from "@cardapio/contracts"
import { defaultPrintingSettings } from "@cardapio/domain/printing"
import { Failure } from "@cardapio/domain/failure"
import type {
  Order,
  Payment,
  Prisma,
  StorePrinting,
} from "../../../generated/prisma/client.js"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import { assertOrderSnapshot } from "../../orders/domain/order.js"
import type { PrintingRepository } from "../application/ports.js"

function settingsView(row: StorePrinting | null): PrintingSettings {
  if (!row) return defaultPrintingSettings()
  const parsed = printingSettingsSchema.safeParse({
    ...(row.configuration as object),
    revision: row.revision,
  })
  if (!parsed.success || !validLogoStructure(parsed.data.logo))
    throw new Failure(
      "CORRUPT_DATA",
      "A configuração de impressão está inválida. Contate o suporte.",
    )
  return parsed.data
}
function orderView(row: Order) {
  const parsed = orderSchema.safeParse({
    id: row.id,
    restaurantId: row.restaurantId,
    revision: row.revision,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    customer: row.customer,
    items: row.items,
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryFee: row.deliveryFee,
    total: row.total,
    promotionId: row.promotionId,
    promotionName: row.promotionName,
    fulfillment: row.fulfillment ?? { mode: "DELIVERY" },
    region: row.region,
    eta: row.eta,
    courierId: row.courierId,
  })
  if (!parsed.success) throw new Failure("CORRUPT_DATA", "Pedido com dados inválidos.")
  try {
    assertOrderSnapshot(parsed.data)
  } catch {
    throw new Failure("CORRUPT_DATA", "Pedido com valores inconsistentes.")
  }
  return parsed.data
}
function paymentView(row: Payment) {
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
  const completeReversal =
    row.reversedAt !== null && row.reversedBy !== null && row.reversalReason !== null
  const noReversal =
    row.reversedAt === null && row.reversedBy === null && row.reversalReason === null
  if (
    !parsed.success ||
    (!completeReversal && !noReversal) ||
    (row.reversedAt && row.reversedAt < row.createdAt)
  )
    throw new Failure("CORRUPT_DATA", "Recebimento com dados inconsistentes.")
  return parsed.data
}
async function store(tx: Transaction, scope: TenantScope) {
  const row = await tx.restaurant.findFirst({
    where: { id: scope.restaurantId, tenantId: scope.tenantId },
    select: { id: true, name: true, address: true, whatsapp: true },
  })
  if (!row) throw new Failure("NOT_FOUND", "Restaurante não encontrado.")
  return { id: row.id, name: row.name, address: row.address, phone: row.whatsapp }
}
export class PrismaPrinting implements PrintingRepository {
  constructor(private readonly db: Database) {}
  settings(scope: TenantScope) {
    return this.db.snapshot(async (tx) => {
      await store(tx, scope)
      return settingsView(await tx.storePrinting.findFirst({ where: scope }))
    })
  }
  update(scope: TenantScope, input: UpdatePrintingSettings) {
    return this.db.transaction(async (tx) => {
      await lockRestaurant(tx, scope)
      await store(tx, scope)
      const previous = await tx.storePrinting.findFirst({ where: scope })
      settingsView(previous)
      if ((previous?.revision ?? 0) !== input.expectedRevision)
        throw new Failure(
          "CONFLICT",
          "As configurações mudaram. Atualize antes de salvar.",
        )
      if (!validLogoStructure(input.logo))
        throw new Failure(
          "VALIDATION",
          "Use uma imagem PNG válida de até 2.048 pixels por lado.",
          { logo: "A imagem PNG está inválida ou grande demais." },
        )
      const { expectedRevision, ...configuration } = input
      const next = await tx.storePrinting.upsert({
        where: { tenantId_restaurantId: scope },
        create: {
          ...scope,
          revision: expectedRevision + 1,
          configuration: configuration as unknown as Prisma.InputJsonValue,
        },
        update: {
          revision: expectedRevision + 1,
          configuration: configuration as unknown as Prisma.InputJsonValue,
        },
      })
      return settingsView(next)
    })
  }
  source(
    scope: TenantScope,
    kind: ReceiptKind,
    id: string,
    operator: { userId: string; role: Role },
  ) {
    return this.db.snapshot(async (tx) => {
      const restaurant = await store(tx, scope)
      const settings = settingsView(await tx.storePrinting.findFirst({ where: scope }))
      const paymentRow =
        kind === "PAYMENT"
          ? await tx.payment.findFirst({ where: { ...scope, id } })
          : null
      if (kind === "PAYMENT" && !paymentRow)
        throw new Failure("NOT_FOUND", "Recebimento não encontrado.")
      const orderId = kind === "PAYMENT" ? paymentRow!.orderId : id
      const orderRow = orderId
        ? await tx.order.findFirst({
            where: {
              ...scope,
              id: orderId,
              ...(operator.role === "COURIER" ? { courierId: operator.userId } : {}),
            },
          })
        : null
      if (orderId && !orderRow)
        throw new Failure(
          "NOT_FOUND",
          "Pedido não encontrado ou indisponível para seu perfil.",
        )
      const payments = orderId
        ? await tx.payment.findMany({ where: { ...scope, orderId }, take: 5001 })
        : []
      if (payments.length > 5000)
        throw new Failure(
          "VALIDATION",
          "O pedido excede o limite de recebimentos para este documento.",
        )
      return {
        restaurant,
        settings,
        order: orderRow ? orderView(orderRow) : null,
        payment: paymentRow ? paymentView(paymentRow) : null,
        payments: payments.map(paymentView),
      }
    })
  }
}
