import type { FinancialReport } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
import type { TableDocument } from "../../../shared/application/documents"
import { orderLabels } from "../../orders/presentation/order-labels"
import { financeTime, paymentLabels } from "./payment-labels"

export function reportDocument(
  report: FinancialReport,
  restaurant: string,
): TableDocument {
  const s = report.summary
  return {
    title: `Relatório de pedidos e recebimentos - ${restaurant}`,
    subtitle: `${financeTime(report.range.from)} até ${financeTime(new Date(Date.parse(report.range.to) - 1).toISOString())} (Brasília). Gerado em ${financeTime(report.generatedAt)}. Vendas pela criação do pedido; caixa pela data do recebimento/reversão. Saldo dos pedidos na data da consulta.`,
    filename: `relatorio-${report.range.from.slice(0, 10)}.pdf`,
    sections: [
      {
        title: "Resumo",
        columns: ["Indicador", "Resultado"],
        rows: [
          ["Pedidos / cancelados", `${s.orders} / ${s.cancelled}`],
          ["Vendas (exceto cancelados, incluindo frete)", formatMoney(s.sales)],
          ["Descontos", formatMoney(s.discounts)],
          ["Taxas de entrega", formatMoney(s.deliveryFees)],
          [
            "Saldo atual dos pedidos não cancelados do período",
            formatMoney(s.outstanding),
          ],
          ["Recebimentos no período", formatMoney(s.received)],
          ["Reversões no período", formatMoney(s.reversed)],
          ["Recebimentos líquidos", formatMoney(s.netReceived)],
        ],
      },
      {
        title: "Recebimentos por forma",
        columns: ["Forma", "Recebido", "Revertido", "Líquido"],
        rows: report.methods.map((m) => [
          paymentLabels[m.method],
          formatMoney(m.received),
          formatMoney(m.reversed),
          formatMoney(m.received - m.reversed),
        ]),
      },
      {
        title: "Vendas por dia (exceto cancelados)",
        columns: ["Dia", "Pedidos", "Vendas"],
        rows: report.daily.map((d) => [
          d.day.split("-").reverse().join("/"),
          d.orders,
          formatMoney(d.sales),
        ]),
      },
      {
        title: "Pedidos do período",
        columns: [
          "Identificador",
          "Criado em",
          "Etapa",
          "Modalidade",
          "Subtotal",
          "Desconto",
          "Frete",
          "Total",
          "Recebido atual",
        ],
        rows: report.orders.map((o) => [
          o.id,
          financeTime(o.createdAt),
          orderLabels[o.status],
          o.fulfillment === "PICKUP" ? "Retirada" : "Entrega",
          formatMoney(o.subtotal),
          formatMoney(o.discount),
          formatMoney(o.deliveryFee),
          formatMoney(o.total),
          formatMoney(o.paid),
        ]),
      },
      {
        title: "Histórico de recebimentos e reversões",
        columns: [
          "Identificador / pedido",
          "Recebido em",
          "Forma",
          "Valor",
          "Revertido em",
          "Descrição / motivo",
          "Operador / reversor",
        ],
        rows: report.payments.map((p) => [
          `${p.id}\n${p.orderId ?? "Avulso"}`,
          financeTime(p.createdAt),
          paymentLabels[p.method],
          formatMoney(p.amount),
          p.reversedAt ? financeTime(p.reversedAt) : "-",
          [p.description, p.reversalReason].filter(Boolean).join(" / "),
          `${p.recordedBy}\n${p.reversedBy ?? "-"}`,
        ]),
      },
    ],
  }
}
