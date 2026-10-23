import { Failure } from "@cardapio/domain/failure"
import { assertCents, formatMoney } from "@cardapio/domain/money"
import { whatsappInline } from "@cardapio/domain/order-message"
import { pricedLineSchema } from "@cardapio/contracts"

export interface CustomerEvent {
  kind: string
  status: string
  orderId: string
}
export interface CustomerOrder {
  status: string
  fulfillment: unknown
  total: number
  subtotal: number
  deliveryFee: number
  discount: number
  items: unknown
  eta: string
  restaurant: { name: string }
}

export function fulfillmentMode(value: unknown): string {
  return value &&
    typeof value === "object" &&
    "mode" in value &&
    typeof value.mode === "string"
    ? value.mode
    : "DELIVERY"
}

export function isFinancialEvent(event: CustomerEvent) {
  return event.kind === "PAYMENT" || event.kind === "REVERSAL"
}

/** Customer alerts highlight actionable milestones. The live board retains every stage. */
export function customerMessageRelevant(
  event: CustomerEvent,
  order: Pick<CustomerOrder, "status" | "fulfillment">,
) {
  if (isFinancialEvent(event) || event.kind === "SUBSCRIBED") return true
  if (event.kind !== "ORDER") return false
  if (event.status === "NEW") return ["NEW", "PREPARING"].includes(order.status)
  if (event.status !== order.status) return false
  return (
    event.status === "CANCELLED" ||
    event.status === "OUT_FOR_DELIVERY" ||
    (event.status === "READY" && fulfillmentMode(order.fulfillment) !== "DELIVERY")
  )
}

export const financialMessageDelayMs = 10_000

// User-supplied names cannot inject a heading, formatting or hidden direction controls.
function inline(value: string) {
  return whatsappInline(value).slice(0, 120)
}

function short(value: string, length: number) {
  const clean = whatsappInline(value)
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean
}

/** Use the saved quote, never today's catalog prices. Bound long carts for mobile reading. */
function receipt(order: CustomerOrder) {
  for (const amount of [order.subtotal, order.deliveryFee, order.discount])
    assertCents(amount, "receipt")
  const parsed = pricedLineSchema.array().min(1).max(100).safeParse(order.items)
  if (
    !parsed.success ||
    (fulfillmentMode(order.fulfillment) === "PICKUP" && order.deliveryFee !== 0) ||
    parsed.data.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) !==
      order.subtotal ||
    order.subtotal + order.deliveryFee - order.discount !== order.total
  )
    throw new Failure("CORRUPT_DATA", "Resumo do pedido inconsistente.")
  return [
    "🧾 *Resumo do pedido*",
    ...parsed.data.slice(0, 6).flatMap((item) => [
      `- ${item.quantity} × ${short(item.name, 72)} · ${formatMoney(item.unitPrice * item.quantity)}`,
      ...(item.components?.length
        ? [
            `  ${item.components
              .slice(0, 3)
              .map((part) => short(part, 50))
              .join(" · ")}${item.components.length > 3 ? " · …" : ""}`,
          ]
        : []),
    ]),
    ...(parsed.data.length > 6
      ? ["Outros produtos e detalhes: veja o acompanhamento."]
      : []),
    "",
    `Subtotal dos produtos: ${formatMoney(order.subtotal)}`,
    ...(fulfillmentMode(order.fulfillment) === "PICKUP"
      ? []
      : [`Taxa de entrega: ${formatMoney(order.deliveryFee)}`]),
    ...(order.discount ? [`Desconto: −${formatMoney(order.discount)}`] : []),
    `Total do pedido: *${formatMoney(order.total)}*`,
  ]
}

function stage(order: CustomerOrder) {
  const pickup = fulfillmentMode(order.fulfillment) === "PICKUP"
  const stages: Record<string, string> = {
    NEW: "Recebido pela loja",
    PREPARING: "Em preparo",
    READY: pickup ? "Pronto para retirada" : "Pronto",
    OUT_FOR_DELIVERY: "A caminho do endereço informado",
    COMPLETED: "Concluído pela loja",
    CANCELLED: "Cancelado pela loja",
  }
  return stages[order.status] ?? "Consulte o acompanhamento"
}

export function customerWhatsappMessage(
  event: CustomerEvent,
  order: CustomerOrder,
  paid?: number,
) {
  assertCents(order.total, "total")
  const financial = isFinancialEvent(event),
    cancelled = order.status === "CANCELLED",
    pickup = fulfillmentMode(order.fulfillment) === "PICKUP",
    code = event.orderId.slice(0, 8).toUpperCase()
  const heading = financial
    ? event.kind === "REVERSAL"
      ? "⚠️ Registro de pagamento corrigido"
      : "💳 Pagamento atualizado"
    : event.kind === "SUBSCRIBED"
      ? "🔔 Avisos automáticos ativados"
      : cancelled
        ? "⚠️ Pedido cancelado"
        : event.status === "READY"
          ? pickup
            ? "🛍️ Pode vir retirar!"
            : "🍽️ Seu pedido está pronto"
          : event.status === "OUT_FOR_DELIVERY"
            ? "🛵 Seu pedido saiu para entrega"
            : "✅ Pedido recebido"
  const lines = [
    `*${heading}*`,
    `*${inline(order.restaurant.name)}* · Pedido *#${code}*`,
    "",
  ]
  if (financial) {
    assertCents(paid, "paid")
    if (paid > order.total)
      throw new Failure("CORRUPT_DATA", "Saldo de pedido inconsistente.")
    lines.push(
      event.kind === "REVERSAL"
        ? "A loja reverteu um registro manual. Isso não realiza um estorno bancário."
        : "A loja registrou um recebimento. Confira o saldo atualizado:",
      "",
      "🧾 *Resumo do pagamento*",
      `Total do pedido: *${formatMoney(order.total)}*`,
      `Recebido registrado (após reversões): *${formatMoney(paid)}*`,
      cancelled
        ? "Pedido cancelado: sem saldo a cobrar. Combine eventual devolução com a loja."
        : `Saldo a pagar: *${formatMoney(order.total - paid)}*`,
    )
    if (!cancelled && paid === order.total)
      lines.push("✅ Quitado nos registros da loja.")
    else if (!cancelled)
      lines.push("O pedido ainda não está quitado. Combine o saldo com a loja.")
  } else {
    lines.push(`Etapa atual: *${stage(order)}*`, "")
    if (event.kind === "SUBSCRIBED")
      lines.push(
        "Você receberá automaticamente os avisos importantes deste pedido. Não precisa enviar uma mensagem à loja.",
      )
    else if (event.status === "NEW")
      lines.push(
        "Tudo certo! Seu pedido já está no sistema da loja. Não é necessário reenviá-lo pelo WhatsApp.",
      )
    else if (event.status === "READY" && pickup)
      lines.push("Informe o número do pedido ao retirar no estabelecimento.")
    else if (event.status === "OUT_FOR_DELIVERY")
      lines.push("Seu pedido está a caminho! Fique disponível para receber a entrega.")
    else if (cancelled)
      lines.push(
        "Se houver pagamento, fale com a loja sobre a devolução. Cancelar o pedido não faz estorno bancário.",
      )
    const initial =
      (event.status === "NEW" || event.kind === "SUBSCRIBED") &&
      !["COMPLETED", "CANCELLED"].includes(order.status)
    lines.push(
      "",
      ...(initial ? receipt(order) : [`Total do pedido: *${formatMoney(order.total)}*`]),
    )
    if (initial)
      lines.push(
        "",
        pickup
          ? "🛍️ *Retirada no estabelecimento*"
          : "🛵 *Entrega no endereço informado*",
      )
    // The saved ETA is the original estimate, not a fresh countdown at every milestone.
    if (order.eta && initial && ["NEW", "PREPARING"].includes(order.status))
      lines.push(`Prazo estimado na confirmação: *${inline(order.eta)}*`)
    lines.push("", "Esta atualização de etapa não confirma pagamento.")
  }
  lines.push(
    "",
    "📲 Acompanhe todas as etapas na página do pedido.",
    "Para parar os avisos, desative o WhatsApp nessa página.",
  )
  return lines.join("\n")
}
