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
          <p>
            Pedidos pela data de criação; recebimentos e reversões pela data do registro.
          </p>
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
            Consultado em {financeTime(report.generatedAt)} (UTC−03). Etapas,
            cancelamentos e saldos refletem esta consulta, inclusive alterações
            posteriores ao período. Não é um fechamento histórico imutável. Os registros
            são manuais; não representam lucro, saldo bancário ou conciliação de cartão.
          </p>
          <div className="finance-metrics">
            {[
              [
                "Total dos pedidos válidos",
                formatMoney(report.summary.sales),
                "Criados no período e não cancelados; inclui os em andamento, frete e descontos",
              ],
              [
                "Recebimentos menos reversões",
                formatMoney(report.summary.netReceived),
                "Registros do período, incluindo avulsos e pedidos de outras datas; pode ser negativo",
              ],
              [
                "Falta receber desses pedidos",
                formatMoney(report.summary.outstanding),
                "Saldo na consulta dos pedidos válidos criados no período; pode incluir pagamentos posteriores",
              ],
              [
                "Pedidos criados",
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
          <div
            className="finance-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Composição dos valores"
          >
            <table className="finance-table">
              <caption>Composição dos pedidos válidos criados no período</caption>
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Produtos e adicionais antes dos descontos</td>
                  <td>{formatMoney(report.summary.subtotal)}</td>
                </tr>
                <tr>
                  <td>+ Frete antes dos descontos</td>
                  <td>{formatMoney(report.summary.deliveryFees)}</td>
                </tr>
                <tr>
                  <td>− Descontos em produtos ou frete</td>
                  <td>{formatMoney(report.summary.discounts)}</td>
                </tr>
                <tr>
                  <td>= Total dos pedidos válidos</td>
                  <td>{formatMoney(report.summary.sales)}</td>
                </tr>
                <tr>
                  <td>− Recebimentos válidos desses pedidos até a consulta</td>
                  <td>
                    {formatMoney(report.summary.sales - report.summary.outstanding)}
                  </td>
                </tr>
                <tr>
                  <td>= Falta receber desses pedidos</td>
                  <td>{formatMoney(report.summary.outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="field-help">
            Avulsos e pedidos de outras datas não compõem o total dos pedidos acima. Os
            recebimentos por forma abaixo usam a data do movimento, por isso não precisam
            coincidir com esse total.
          </p>
          {report.summary.cancelledPaid > 0 && (
            <p className="info-notice">
              Pedidos cancelados criados no período ainda têm{" "}
              {formatMoney(report.summary.cancelledPaid)} em recebimentos não revertidos.
              Confira as devoluções. Esses pedidos não entram no total nem no saldo a
              cobrar, mas seus registros continuam nos movimentos das respectivas datas.
            </p>
          )}
          <FeatureBoundary label="Resumo de recebimentos">
            <div
              className="finance-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Recebimentos por forma"
            >
              <table className="finance-table">
                <caption>Movimentos registrados no período, por forma</caption>
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th>Entradas (+)</th>
                    <th>Reversões (−)</th>
                    <th>Entradas − reversões</th>
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
                <tfoot>
                  <tr>
                    <th scope="row">Total do período</th>
                    <td>{formatMoney(report.summary.received)}</td>
                    <td>{formatMoney(report.summary.reversed)}</td>
                    <td>{formatMoney(report.summary.netReceived)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </FeatureBoundary>
          <p className="field-help">
            Reverter um recebimento antigo subtrai o valor na data da reversão; não apaga
            a entrada da data original. Reversão é um ajuste manual, sem devolução
            bancária automática. Taxas de cartão e despesas não são calculadas.
          </p>
          <div
            className="finance-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Pedidos por dia"
          >
            <table className="finance-table">
              <caption>Pedidos válidos por dia de criação · UTC−03</caption>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Pedidos</th>
                  <th>Total com frete e descontos</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day.split("-").reverse().join("/")}</td>
                    <td>{d.orders}</td>
                    <td>{formatMoney(d.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  <th>Total original</th>
                  <th>Recebido válido na consulta</th>
                  <th>A cobrar na consulta</th>
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
                    <td>
                      {o.status === "CANCELLED"
                        ? "Cancelado · sem cobrança"
                        : formatMoney(o.total - o.paid)}
                    </td>
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
