import {
  receiptDocumentSchema,
  type ReceiptDocument,
  type ReceiptKind,
} from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import { sumCents } from "@cardapio/domain/payments"
import { deliveryAddressLines } from "@cardapio/domain/delivery-address"
import { assertOrderSnapshot } from "../../orders/domain/order.js"
import type { PrintingSource } from "./ports.js"

/** Builds only the fields authorized for this purpose; templates never grant access. */
export function buildReceipt(
  source: PrintingSource,
  kind: ReceiptKind,
  generatedAt: string,
): ReceiptDocument {
  const { order, payment, settings } = source
  if (order) assertOrderSnapshot(order)
  if ((kind === "PAYMENT" && !payment) || (kind !== "PAYMENT" && !order))
    throw new Failure("CORRUPT_DATA", "Documento sem registro de origem válido.")
  const paid = sumCents(source.payments.filter((p) => !p.reversedAt).map((p) => p.amount))
  if (order && paid > order.total)
    throw new Failure("CORRUPT_DATA", "O saldo do pedido está inconsistente.")
  const kitchen = kind === "KITCHEN"
  const profile = settings.profiles.find((p) => p.id === settings.defaults[kind])
  const parsed = receiptDocumentSchema.safeParse({
    profile,
    template: settings.templates[kind],
    snapshot: {
      kind,
      generatedAt,
      restaurant: { ...source.restaurant, logo: settings.logo },
      source: {
        orderId: order?.id ?? null,
        paymentId: payment?.id ?? null,
        orderRevision: order?.revision ?? null,
        createdAt: payment?.createdAt ?? order!.createdAt,
        status: order?.status ?? null,
        paymentStatus: payment ? (payment.reversedAt ? "REVERSED" : "VALID") : null,
      },
      customer:
        order && !kitchen && kind !== "PAYMENT"
          ? {
              name: order.customer.name,
              phone: order.customer.phone,
              notes: order.customer.notes,
              payment: order.customer.payment,
              cashChange: order.customer.cashChange,
              address:
                order.fulfillment?.mode === "PICKUP"
                  ? "Retirada na loja"
                  : order.customer.deliveryAddress
                    ? deliveryAddressLines(order.customer.deliveryAddress).join("\n")
                    : order.customer.address,
            }
          : null,
      items:
        kind === "PAYMENT"
          ? []
          : order!.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: kitchen ? null : item.unitPrice,
              total: kitchen ? null : item.unitPrice * item.quantity,
              components: item.components ?? [],
              note: item.note,
            })),
      totals:
        !kitchen && order
          ? {
              subtotal: order.subtotal,
              discount: order.discount ?? 0,
              deliveryFee: order.deliveryFee,
              total: order.total,
              paid,
              outstanding: order.status === "CANCELLED" ? 0 : order.total - paid,
            }
          : null,
      payment: payment
        ? {
            amount: payment.amount,
            method: payment.method,
            description: payment.description,
            createdAt: payment.createdAt,
            reversedAt: payment.reversedAt,
            reversalReason: payment.reversalReason,
          }
        : null,
      notes: !kitchen && kind !== "PAYMENT" ? order!.customer.notes : "",
    },
  })
  if (!parsed.success)
    throw new Failure("CORRUPT_DATA", "Os dados do documento estão inconsistentes.")
  return parsed.data
}
