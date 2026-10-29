import { Bike, Crown, Flame } from "lucide-react"
import type { AnalyticsReport } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
export default function AnalyticsRankings({ report }: { report: AnalyticsReport }) {
  return (
    <div className="analytics-rankings">
      <section className="analytics-panel" aria-labelledby="top-products-title">
        <header>
          <div>
            <h2 id="top-products-title">
              <Flame size={19} aria-hidden="true" />O que mais sai da cozinha
            </h2>
            <p>Ranking por unidades vendidas. Combos aparecem como itens próprios.</p>
          </div>
        </header>
        {!report.products.length ? (
          <p className="analytics-empty">
            Os produtos aparecem aqui quando há pedidos concluídos no período.
          </p>
        ) : (
          <ol className="analytics-ranking-list">
            {report.products.map((product, index) => (
              <li key={`${product.kind}:${product.id}`}>
                <span className="ranking-position">{index + 1}</span>
                <div>
                  <strong>{product.name}</strong>
                  <small>
                    {product.kind === "COMBO" ? "Combo" : "Produto"} · {product.units}{" "}
                    {product.units === 1 ? "unidade" : "unidades"}
                  </small>
                  <span className="ranking-meter">
                    <i
                      style={{
                        width: `${(product.units / report.products[0]!.units) * 100}%`,
                      }}
                    />
                  </span>
                </div>
                <b>{formatMoney(product.revenue)}</b>
              </li>
            ))}
          </ol>
        )}
        <small className="analytics-panel-note">
          Valor bruto dos itens, incluindo adicionais, antes de descontos e frete.
        </small>
      </section>
      <section className="analytics-panel" aria-labelledby="top-customers-title">
        <header>
          <div>
            <h2 id="top-customers-title">
              <Crown size={19} aria-hidden="true" />
              Clientes que mais compram
            </h2>
            <p>Por número de pedidos concluídos; desempate pelo valor comprado.</p>
          </div>
        </header>
        {!report.customers.length ? (
          <p className="analytics-empty">
            Seus clientes recorrentes aparecerão conforme as compras forem concluídas.
          </p>
        ) : (
          <ol className="analytics-ranking-list">
            {report.customers.map((customer, index) => (
              <li key={customer.id}>
                <span className="ranking-position">{index + 1}</span>
                <div>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.phoneMasked} · {customer.orders}{" "}
                    {customer.orders === 1 ? "pedido" : "pedidos"}
                  </small>
                </div>
                <b>{formatMoney(customer.total)}</b>
              </li>
            ))}
          </ol>
        )}
        <small className="analytics-panel-note">
          Clientes agrupados pelo telefone do pedido. Acesso restrito à gestão.
        </small>
      </section>
      <section
        className="analytics-panel analytics-couriers"
        aria-labelledby="top-couriers-title"
      >
        <header>
          <div>
            <h2 id="top-couriers-title">
              <Bike size={19} aria-hidden="true" />
              Entregadores em destaque
            </h2>
            <p>
              Entregas concluídas de pedidos criados no período, sem contar retiradas.
            </p>
          </div>
        </header>
        {!report.couriers.length ? (
          <p className="analytics-empty">
            Atribua entregadores aos pedidos para acompanhar as entregas concluídas.
          </p>
        ) : (
          <div
            className="analytics-table-scroll"
            role="region"
            aria-label="Ranking de entregadores"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Entregador</th>
                  <th>Entregas concluídas</th>
                  <th>Tempo médio na rua</th>
                </tr>
              </thead>
              <tbody>
                {report.couriers.map((courier, index) => (
                  <tr key={courier.id ?? "unavailable"}>
                    <th scope="row">
                      {index + 1}. {courier.name}
                    </th>
                    <td>{courier.deliveries}</td>
                    <td>
                      {courier.avgMinutes === null
                        ? "Sem etapas suficientes"
                        : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(courier.avgMinutes)} min`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
