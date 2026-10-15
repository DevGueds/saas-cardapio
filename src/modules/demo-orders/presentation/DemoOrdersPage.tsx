import { useEffect, useRef, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  ChefHat,
  Clock3,
  FlaskConical,
  Printer,
  ReceiptText,
  Search,
  Truck,
} from "lucide-react"
import { formatMoney } from "../../../shared/domain/money"
import { normalizeName } from "../../../shared/domain/validation"
import PageHeading from "../../../shared/presentation/PageHeading"
import { advanceDemoOrder, type DemoOrderStatus } from "../domain/demo-order"
import { demoOrders } from "../application/demo-orders"
import DemoOrderCard from "./DemoOrderCard"

const columns: {
  id: DemoOrderStatus
  title: string
  description: string
  icon: typeof Clock3
}[] = [
  {
    id: "new",
    title: "Novos pedidos",
    description: "Prontos para começar",
    icon: ReceiptText,
  },
  {
    id: "preparing",
    title: "Em preparo",
    description: "A cozinha está cuidando",
    icon: ChefHat,
  },
  {
    id: "delivery",
    title: "Saiu para entrega",
    description: "A caminho do cliente",
    icon: Truck,
  },
]

export default function DemoOrdersPage() {
  const [orders, setOrders] = useState(demoOrders)
  const movedOrder = useRef<{ id: string; previousStatus: DemoOrderStatus } | null>(null)
  const [filter, setFilter] = useState<DemoOrderStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const visibleOrders = orders.filter((order) =>
    normalizeName(`${order.id} ${order.customer}`).includes(normalizeName(search)),
  )
  const activeColumns = columns.filter(
    (column) => filter === "all" || filter === column.id,
  )

  useEffect(() => {
    const moved = movedOrder.current
    if (!moved) return
    const target =
      document.getElementById(`demo-order-${moved.id}`) ??
      document.getElementById(`orders-${moved.previousStatus}`)
    target?.focus()
    movedOrder.current = null
  }, [orders])

  function advance(id: string) {
    const current = orders.find((order) => order.id === id)
    if (!current || current.status === "delivery") return
    movedOrder.current = { id, previousStatus: current.status }
    setOrders((items) =>
      items.map((item) => (item.id === id ? advanceDemoOrder(item) : item)),
    )
    setNotice(
      `Pedido #${id} movido para ${current.status === "new" ? "Em preparo" : "Saiu para entrega"}.`,
    )
  }

  return (
    <div className="orders-page">
      <PageHeading
        eyebrow="Organize cada etapa"
        title="Gestor de Pedidos"
        description="Da cozinha até a entrega, tudo no seu lugar."
      >
        <button className="secondary-button" type="button" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          Imprimir quadro
        </button>
      </PageHeading>
      <div className="orders-metrics" aria-label="Resumo demonstrativo">
        <div>
          <span className="stat-icon">
            <ReceiptText size={22} aria-hidden="true" />
          </span>
          <span>
            <small>Pedidos de exemplo</small>
            <strong>{orders.length}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon stat-icon--amber">
            <ChefHat size={22} aria-hidden="true" />
          </span>
          <span>
            <small>Em preparo agora</small>
            <strong>
              {orders.filter((order) => order.status === "preparing").length}
            </strong>
          </span>
        </div>
        <div>
          <span className="stat-icon stat-icon--green">
            <Banknote size={22} aria-hidden="true" />
          </span>
          <span>
            <small>Total demonstrativo</small>
            <strong>
              {formatMoney(orders.reduce((sum, order) => sum + order.total, 0))}
            </strong>
          </span>
        </div>
      </div>
      <div className="demo-orders-notice">
        <FlaskConical size={21} aria-hidden="true" />
        <div>
          <strong>Experimente à vontade. Este quadro é uma simulação.</strong>
          <p>
            Clientes e pagamentos são fictícios. Pedidos do WhatsApp não aparecem aqui, e
            as alterações reiniciam ao sair.
          </p>
        </div>
        <span>Demonstração</span>
      </div>
      <div className="orders-toolbar">
        <div className="order-filters" aria-label="Filtrar etapa">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos<span>{orders.length}</span>
          </button>
          {columns.map((column) => (
            <button
              key={column.id}
              type="button"
              aria-pressed={filter === column.id}
              onClick={() => setFilter(column.id)}
            >
              {column.title}
              <span>{orders.filter((order) => order.status === column.id).length}</span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Buscar pedidos"
            placeholder="Número ou nome do cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <p className="sr-only" role="status">
        {notice}
      </p>
      <section
        className={`kanban-board ${filter !== "all" ? "kanban-board--filtered" : ""}`}
        aria-label="Quadro demonstrativo de pedidos"
      >
        {activeColumns.map((column) => {
          const Icon = column.icon
          const items = visibleOrders.filter((order) => order.status === column.id)
          return (
            <section
              className={`kanban-column kanban-column--${column.id}`}
              key={column.id}
              aria-labelledby={`orders-${column.id}`}
            >
              <div className="kanban-column__heading">
                <span className="column-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 tabIndex={-1} id={`orders-${column.id}`}>
                    {column.title}
                  </h2>
                  <p>{column.description}</p>
                </div>
                <span className="column-count">{items.length}</span>
              </div>
              <div className="kanban-list">
                {items.map((order) => (
                  <DemoOrderCard
                    key={order.id}
                    order={order}
                    onAdvance={() => advance(order.id)}
                  />
                ))}
                {!items.length && (
                  <div className="kanban-empty">
                    <CheckCircle2 size={28} aria-hidden="true" />
                    <strong>
                      {search ? "Nenhum resultado" : "Tudo em dia por aqui"}
                    </strong>
                    <p>
                      {search
                        ? "Tente outro nome ou número."
                        : "Nenhum pedido nesta etapa."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </section>
    </div>
  )
}
