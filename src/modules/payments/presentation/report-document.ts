import type { FinancialReport } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
import { paymentActivity } from "@cardapio/domain/payments"
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
    subtitle: `${financeTime(report.range.from)} até ${financeTime(new Date(Date.parse(report.range.to) - 1).toISOString())} (UTC-03 fixo). Consultado em ${financeTime(report.generatedAt)}. Pedidos pela criação; movimentos pela data do registro. Etapas e saldos atuais, inclusive alterações posteriores ao período. Não é fechamento histórico, lucro ou saldo bancário. Valores manuais, sem conciliação ou taxas de cartão.`,
    filename: `relatorio-${report.range.from.slice(0, 10)}.pdf`,
    sections: [
      {
        title: "Resumo",
        columns: ["Indicador", "Resultado"],
        rows: [
          ["Pedidos / cancelados", `${s.orders} / ${s.cancelled}`],
          [
            "Produtos e adicionais antes dos descontos (pedidos válidos)",
            formatMoney(s.subtotal),
          ],
          ["+ Frete antes dos descontos (pedidos válidos)", formatMoney(s.deliveryFees)],
          [
            "- Descontos em produtos ou frete (pedidos válidos)",
            formatMoney(s.discounts),
          ],
          ["= Total dos pedidos válidos, inclusive em andamento", formatMoney(s.sales)],
          [
            "- Recebimentos válidos desses pedidos até a consulta",
            formatMoney(s.sales - s.outstanding),
          ],
          ["= Falta receber desses pedidos até a consulta", formatMoney(s.outstanding)],
          [
            "Recebimentos a conferir em cancelados criados no período",
            formatMoney(s.cancelledPaid),
          ],
          [
            "Entradas registradas no período (inclui avulsos e pedidos de outras datas)",
            formatMoney(s.received),
          ],
          [
            "- Reversões registradas no período (pode reverter entrada antiga)",
            formatMoney(s.reversed),
          ],
          ["= Entradas menos reversões no período", formatMoney(s.netReceived)],
        ],
      },
      {
        title: "Movimentos registrados no período, por forma",
        columns: ["Forma", "Entradas (+)", "Reversões (-)", "Entradas - reversões"],
        rows: report.methods.map((m) => [
          paymentLabels[m.method],
          formatMoney(m.received),
          formatMoney(m.reversed),
          formatMoney(m.received - m.reversed),
        ]),
      },
      {
        title: "Pedidos válidos por dia de criação (UTC-03)",
        columns: ["Dia", "Pedidos", "Total com frete e descontos"],
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
          "Total original",
          "Recebido válido na consulta",
          "A cobrar na consulta",
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
          o.status === "CANCELLED" ? "Sem cobrança" : formatMoney(o.total - o.paid),
        ]),
      },
      {
        title:
          "Movimentos que compõem o período (reversão não devolve dinheiro automaticamente)",
        columns: [
          "Data (UTC-03)",
          "Movimento",
          "Valor com sinal",
          "Forma",
          "Registro / pedido",
          "Operador",
          "Descrição / motivo",
        ],
        rows: report.payments.flatMap((p) => {
          const activity = paymentActivity(p, report.range)
          return [
            ...(activity.received
              ? [
                  [
                    financeTime(p.createdAt),
                    "Entrada",
                    formatMoney(activity.received),
                    paymentLabels[p.method],
                    `${p.id}\n${p.orderId ?? "Avulso"}`,
                    p.recordedBy,
                    p.description,
                  ],
                ]
              : []),
            ...(activity.reversed
              ? [
                  [
                    financeTime(p.reversedAt!),
                    "Reversão",
                    formatMoney(-activity.reversed),
                    paymentLabels[p.method],
                    `${p.id}\n${p.orderId ?? "Avulso"}`,
                    p.reversedBy!,
                    p.reversalReason ?? "",
                  ],
                ]
              : []),
          ]
        }),
      },
      {
        title:
          "Histórico atual dos registros envolvidos (datas podem estar fora do período)",
        columns: [
          "Identificador / pedido",
          "Recebido em",
          "Forma",
          "Valor original",
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
