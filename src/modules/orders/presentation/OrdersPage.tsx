import { useState } from "react"
import { RefreshCw, Search, ShoppingBag } from "lucide-react"
import type { OrderStatus, OrderView } from "@cardapio/contracts"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useOrders } from "./use-orders"
import { orderLabels, shortOrder } from "./order-labels"
import OrderCard from "./OrderCard"
import OrderDetails from "./OrderDetails"
const active: OrderStatus[] = ["NEW", "PREPARING", "OUT_FOR_DELIVERY"]
export default function OrdersPage() {
  const { menu, error: menuError } = useMenu(),
    { orders } = useServices()
  const listing = useOrders(menu.restaurant.id),
    mutation = useMutation()
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = listing.data?.items.find((order) => order.id === selectedId)
  const statuses: OrderStatus[] =
    filter === "active" ? active : filter === "completed" ? ["COMPLETED"] : ["CANCELLED"]
  const items = (listing.data?.items ?? []).filter((order) =>
    `${shortOrder(order.id)} ${order.customer.name}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  )
  const blocked = listing.loading || !!listing.error || !!menuError || mutation.pending
  async function transition(order: OrderView, status: OrderStatus) {
    if (!orders || blocked) return
    const result = await mutation.run(() =>
      orders.transition(menu.restaurant.id, order.id, order.revision, status),
    )
    if (result?.ok) {
      setSelectedId(null)
      await listing.reload()
    }
  }
  return (
    <section aria-labelledby="orders-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Operação da loja</p>
          <h1 id="orders-title">Pedidos</h1>
          <p className="page-description">
            Do primeiro aviso até a entrega. Acompanhe cada pedido enviado pelo seu
            cardápio.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={listing.loading}
          onClick={() => void listing.reload()}
        >
          <RefreshCw size={17} aria-hidden="true" />
          {listing.loading ? "Atualizando…" : "Atualizar pedidos"}
        </button>
      </header>
      <div className="live-orders-toolbar">
        <div className="live-order-tabs" role="group" aria-label="Situação dos pedidos">
          {[
            ["active", "Em andamento"],
            ["completed", "Concluídos"],
            ["cancelled", "Cancelados"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="live-order-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar pedidos nesta página</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome ou número do pedido"
          />
        </label>
      </div>
      <p className="field-help live-orders-caption">
        Atualização a cada 15 segundos. Página {listing.page} · até 50 pedidos por página.
        Os filtros se aplicam a esta página.
      </p>
      {listing.error && (
        <ErrorNotice error={listing.error} onRetry={() => void listing.reload()} />
      )}
      {mutation.error && (
        <ErrorNotice error={mutation.error} onRetry={() => void listing.reload()} />
      )}
      {!listing.data && listing.loading ? (
        <p role="status" className="info-notice">
          Buscando pedidos da loja…
        </p>
      ) : (
        <div
          className={`live-order-board ${statuses.length === 1 ? "live-order-board--single" : ""}`}
        >
          {statuses.map((status) => {
            const group = items.filter((order) => order.status === status)
            return (
              <section
                className={`live-order-column live-order-column--${status.toLowerCase()}`}
                key={status}
                aria-label={orderLabels[status]}
              >
                <header>
                  <h2>{orderLabels[status]}</h2>
                  <span>{group.length}</span>
                </header>
                <div className="live-order-stack">
                  {group.length ? (
                    group.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        disabled={blocked}
                        onDetails={() => setSelectedId(order.id)}
                        onTransition={(next) => void transition(order, next)}
                      />
                    ))
                  ) : (
                    <div className="live-orders-empty">
                      <ShoppingBag size={28} aria-hidden="true" />
                      <p>Nenhum pedido nesta etapa</p>
                      <small>
                        {query
                          ? "Tente buscar outro nome ou número."
                          : "Os pedidos aparecerão aqui quando chegarem a esta etapa."}
                      </small>
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <nav className="orders-pagination" aria-label="Páginas de pedidos">
        <button
          className="secondary-button"
          disabled={listing.page === 1 || listing.loading}
          onClick={listing.previous}
        >
          Mais recentes
        </button>
        <span>Página {listing.page}</span>
        <button
          className="secondary-button"
          disabled={!listing.data?.nextCursor || listing.loading}
          onClick={listing.next}
        >
          Mais antigos
        </button>
      </nav>
      {selected && (
        <OrderDetails
          key={selected.id}
          order={selected}
          disabled={blocked}
          busy={mutation.pending}
          error={mutation.error ?? listing.error ?? menuError}
          onRetry={() => void listing.reload()}
          onClose={() => setSelectedId(null)}
          onCancel={() => void transition(selected, "CANCELLED")}
        />
      )}
    </section>
  )
}
