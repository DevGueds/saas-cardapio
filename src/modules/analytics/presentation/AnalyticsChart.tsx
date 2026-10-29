import { useState } from "react"
import type { AnalyticsReport } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
export default function AnalyticsChart({
  series,
}: {
  series: AnalyticsReport["series"]
}) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue"),
    [active, setActive] = useState<number | null>(null)
  const maximum = Math.max(1, ...series.map((value) => value[metric])),
    selected = active === null ? null : series[active]
  const format = (value: number) =>
    metric === "revenue" ? formatMoney(value) : `${value} pedidos`
  return (
    <section
      className="analytics-panel analytics-trend"
      aria-labelledby="sales-trend-title"
    >
      <header>
        <div>
          <h2 id="sales-trend-title">O ritmo das suas vendas</h2>
          <p>Pedidos concluídos ao longo do período selecionado.</p>
        </div>
        <div className="analytics-segmented" role="group" aria-label="Métrica do gráfico">
          <button
            type="button"
            aria-pressed={metric === "revenue"}
            onClick={() => {
              setMetric("revenue")
              setActive(null)
            }}
          >
            Vendas em R$
          </button>
          <button
            type="button"
            aria-pressed={metric === "orders"}
            onClick={() => {
              setMetric("orders")
              setActive(null)
            }}
          >
            Pedidos
          </button>
        </div>
      </header>
      <output className="analytics-chart-value" aria-live="polite">
        {selected
          ? `${selected.label} · ${selected.future ? "Período futuro" : format(selected[metric])}`
          : "Selecione uma barra para ver os valores"}
      </output>
      <div
        className="analytics-bars"
        aria-label={
          metric === "revenue"
            ? "Gráfico de vendas concluídas"
            : "Gráfico de pedidos concluídos"
        }
      >
        {series.map((bucket, index) => (
          <button
            key={bucket.key}
            type="button"
            className={`${bucket.future ? "is-future" : ""} ${active === index ? "is-selected" : ""}`}
            disabled={bucket.future}
            aria-label={`${bucket.label}: ${bucket.future ? "período futuro" : format(bucket[metric])}`}
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
            onClick={() => setActive(index)}
          >
            <span
              style={{
                height: `${bucket.future ? 2 : Math.max(2, (bucket[metric] / maximum) * 100)}%`,
              }}
            />
          </button>
        ))}
      </div>
      <div className="analytics-chart-labels" aria-hidden="true">
        {series.map((bucket, index) => (
          <span key={bucket.key}>
            {index % Math.max(1, Math.ceil(series.length / 7)) === 0 ? bucket.label : ""}
          </span>
        ))}
      </div>
      <details className="analytics-data-details">
        <summary>Ver dados do gráfico em tabela</summary>
        <div
          className="analytics-table-scroll"
          role="region"
          aria-label="Dados do gráfico"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Pedidos concluídos</th>
                <th>Vendas</th>
              </tr>
            </thead>
            <tbody>
              {series.map((bucket) => (
                <tr key={bucket.key}>
                  <th scope="row">{bucket.label}</th>
                  <td>{bucket.future ? "—" : bucket.orders}</td>
                  <td>
                    {bucket.future ? "Ainda não ocorreu" : formatMoney(bucket.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
