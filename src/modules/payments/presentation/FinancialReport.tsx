import { useCallback } from "react"
import type { ReportRange } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
import { FileDown } from "lucide-react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import { orderLabels } from "../../orders/presentation/order-labels"
import { financeTime, paymentLabels } from "./payment-labels"
import { reportDocument } from "./report-document"

export default function FinancialReport({
  restaurantId,
  restaurantName,
  range,
}: {
  restaurantId: string
  restaurantName: string
  range: ReportRange
}) {
  const { payments, documents } = useServices(),
    mutation = useMutation()
  const load = useCallback(
    () => payments!.report(restaurantId, range),
    [payments, restaurantId, range],
  )
  const resource = useResource(load),
    report = resource.data
  return (
    <section className="financial-report" aria-label="Relatório gerencial">
      <div className="finance-section-heading">
        <div>
          <h2>Relatório gerencial</h2>
          <p>Todos os pedidos e movimentos do período selecionado.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={
            !report ||
            resource.loading ||
            !!resource.error ||
            mutation.pending ||
            !documents
          }
          onClick={() => {
            if (report && documents)
              void mutation.run(
                () => documents.pdf(reportDocument(report, restaurantName)),
                "PDF gerado.",
              )
          }}
        >
          <FileDown size={18} aria-hidden="true" />
          {mutation.pending ? "Gerando PDF…" : "Baixar relatório PDF"}
        </button>
      </div>
      {resource.loading && <p role="status">Consolidando pedidos e recebimentos…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {mutation.error && <ErrorNotice error={mutation.error} />}
      {report && (
        <>
          <p className="field-help">
            Gerado em {financeTime(report.generatedAt)}. Vendas consideram a criação do
            pedido. Recebimentos e reversões consideram a data do movimento, incluindo
            pedidos antigos e valores avulsos. Saldo em aberto é o saldo atual dos pedidos
            criados no período.
          </p>
          <div className="finance-metrics">
            {[
              [
                "Vendas no período",
                formatMoney(report.summary.sales),
                "Pedidos não cancelados, incluindo frete",
              ],
              [
                "Recebimentos líquidos",
                formatMoney(report.summary.netReceived),
                "Recebimentos menos reversões no período",
              ],
              [
                "Saldo em aberto",
                formatMoney(report.summary.outstanding),
                "Saldo atual dos pedidos não cancelados do período",
              ],
              [
                "Pedidos",
                String(report.summary.orders),
                `${report.summary.cancelled} cancelados`,
              ],
            ].map(([label, value, help]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{help}</small>
              </article>
            ))}
          </div>
          <FeatureBoundary label="Resumo de recebimentos">
            <div
              className="finance-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Recebimentos por forma"
            >
              <table className="finance-table">
                <caption>Recebimentos por forma</caption>
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th>Recebido</th>
                    <th>Revertido</th>
                    <th>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {report.methods.map((m) => (
                    <tr key={m.method}>
                      <td>{paymentLabels[m.method]}</td>
                      <td>{formatMoney(m.received)}</td>
                      <td>{formatMoney(m.reversed)}</td>
                      <td>{formatMoney(m.received - m.reversed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FeatureBoundary>
          <div
            className="finance-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Pedidos do relatório"
          >
            <table className="finance-table">
              <caption>Pedidos do período · {report.orders.length}</caption>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Criado em</th>
                  <th>Etapa</th>
                  <th>Total</th>
                  <th>Recebido atual</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.slice(0, 100).map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id.slice(0, 8).toUpperCase()}</td>
                    <td>{financeTime(o.createdAt)}</td>
                    <td>{orderLabels[o.status]}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>{formatMoney(o.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!report.orders.length && (
            <p className="info-notice">Nenhum pedido criado no período.</p>
          )}
          {report.orders.length > 100 && (
            <p className="field-help">
              Prévia dos 100 primeiros pedidos. O PDF inclui todos os{" "}
              {report.orders.length} pedidos e o histórico completo de movimentos do
              período.
            </p>
          )}
        </>
      )}
    </section>
  )
}
