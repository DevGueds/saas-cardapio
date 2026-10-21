import { memo, useDeferredValue, useMemo, useState } from "react"
import type { FinancialReport } from "@cardapio/contracts"
import { formatMoney } from "@cardapio/domain/money"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import { orderLabels } from "../../orders/presentation/order-labels"
import { financeTime } from "./payment-labels"
const pageSize = 25
function ReportOrders({ orders }: { orders: FinancialReport["orders"] }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [balance, setBalance] = useState(""),
    [page, setPage] = useState(0)
  const deferredSearch = useDeferredValue(search.trim().replace(/^#/, "").toLowerCase())
  const filtered = useMemo(
    () =>
      orders.filter(
        (order) =>
          (!deferredSearch || order.id.toLowerCase().includes(deferredSearch)) &&
          (!status || order.status === status) &&
          (!balance ||
            (order.status !== "CANCELLED" &&
              (balance === "pending"
                ? order.paid < order.total
                : order.paid === order.total))),
      ),
    [orders, deferredSearch, status, balance],
  )
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  )
  return (
    <section className="finance-orders">
      <div className="finance-section-heading">
        <div>
          <h2>Detalhamento dos pedidos</h2>
          <p>Pesquise dentro de todos os pedidos do período aplicado.</p>
        </div>
      </div>
      <div className="finance-detail-filters">
        <InputField
          label="Buscar número do pedido"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <SelectField
          label="Etapa do pedido"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Todas as etapas</option>
          {Object.entries(orderLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Saldo do pedido"
          value={balance}
          onChange={(e) => {
            setBalance(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Todos os saldos</option>
          <option value="pending">Com valor a receber</option>
          <option value="settled">Sem valor a receber</option>
        </SelectField>
      </div>
      <p className="field-help" role="status">
        {filtered.length} de {orders.length} pedidos. Estes filtros alteram apenas a
        lista; os indicadores e o PDF abrangem todo o período. Cancelados não têm
        cobrança.
      </p>
      <div
        className="finance-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Pedidos do relatório"
        aria-busy={deferredSearch !== search.trim().replace(/^#/, "").toLowerCase()}
      >
        <table className="finance-table">
          <caption>Pedidos do período · saldos na consulta</caption>
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
            {filtered
              .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
              .map((order) => (
                <tr key={order.id}>
                  <td>#{order.id.slice(0, 8).toUpperCase()}</td>
                  <td>{financeTime(order.createdAt)}</td>
                  <td>{orderLabels[order.status]}</td>
                  <td>{formatMoney(order.total)}</td>
                  <td>{formatMoney(order.paid)}</td>
                  <td>
                    {order.status === "CANCELLED"
                      ? "Cancelado · sem cobrança"
                      : formatMoney(order.total - order.paid)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="info-notice">
          {orders.length
            ? "Nenhum pedido corresponde aos filtros."
            : "Nenhum pedido criado no período."}
        </p>
      )}
      {filtered.length > pageSize && (
        <nav className="orders-pagination" aria-label="Páginas dos pedidos do relatório">
          <button
            type="button"
            className="secondary-button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <span>
            Página {currentPage + 1} de {Math.ceil(filtered.length / pageSize)}
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={(currentPage + 1) * pageSize >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </section>
  )
}
export default memo(ReportOrders)
