import { useState } from "react"

import { CheckCircle2, ChefHat, ChevronRight, Clock3, Printer, Truck } from "lucide-react"

import { formatMoney } from "../../../shared/domain/money"

import { advanceDemoOrder, type DemoOrderStatus } from "../domain/demo-order"

import { demoOrders } from "../application/demo-orders"

const columns: { id: DemoOrderStatus; title: string; icon: typeof Clock3 }[] = [
  { id: "new", title: "Novos pedidos", icon: Clock3 },
  { id: "preparing", title: "Em preparo", icon: ChefHat },

  { id: "delivery", title: "Saiu para entrega", icon: Truck },
]

export default function DemoOrdersPage() {
  const [orders, setOrders] = useState(demoOrders)

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p>Simulação local</p>
          <h1>Gestor de Pedidos</h1>
          <span>
            Exemplos para explorar o painel. Alterações são reiniciadas ao sair.
          </span>
        </div>
        <div className="admin-metrics">
          <div>
            <span>
              <small>Pedidos de exemplo</small>
              <strong>{orders.length}</strong>
            </span>
          </div>
          <div>
            <span>
              <small>Total demonstrativo</small>
              <strong>
                {formatMoney(orders.reduce((sum, order) => sum + order.total, 0))}
              </strong>
            </span>
          </div>
        </div>
      </div>
      <p className="info-notice">
        Este quadro não recebe os pedidos preparados pelo cardápio. Pagamentos e clientes
        são fictícios.
      </p>
      <section className="kanban-board" aria-label="Quadro demonstrativo de pedidos">
        {columns.map((column) => {
          const Icon = column.icon
          const items = orders.filter((order) => order.status === column.id)

          return (
            <div className={`kanban-column kanban-column--${column.id}`} key={column.id}>
              <div className="kanban-column__heading">
                <div>
                  <span className="column-icon">
                    <Icon size={17} />
                  </span>
                  <strong>{column.title}</strong>
                </div>
                <em>{items.length}</em>
              </div>
              <div className="kanban-list">
                {items.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card__top">
                      <div>
                        <span>Pedido de exemplo</span>
                        <strong>#{order.id}</strong>
                      </div>
                      <time>
                        <Clock3 size={13} />
                        {order.time}
                      </time>
                    </div>
                    <div className="order-customer">
                      <span>{order.customer.charAt(0)}</span>
                      <div>
                        <strong>{order.customer}</strong>
                        <button disabled type="button">
                          Contato indisponível na demonstração
                        </button>
                      </div>
                    </div>
                    <ul>
                      {order.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <div className="order-payment">
                      <div>
                        <span>Total</span>
                        <strong>{formatMoney(order.total)}</strong>
                      </div>
                      <span
                        className={`payment-pill payment-pill--${order.paymentStatus}`}
                      >
                        {order.paymentMethod} ·{" "}
                        {order.paymentStatus === "confirmed"
                          ? "Simulado"
                          : "Pendente (exemplo)"}
                      </span>
                    </div>
                    <div className="order-actions">
                      <button type="button" onClick={() => window.print()}>
                        <Printer size={15} />
                        Imprimir quadro
                      </button>
                      {order.status !== "delivery" && (
                        <button
                          type="button"
                          className="order-actions__primary"
                          onClick={() =>
                            setOrders((current) =>
                              current.map((item) =>
                                item.id === order.id ? advanceDemoOrder(item) : item,
                              ),
                            )
                          }
                        >
                          Avançar status
                          <ChevronRight size={15} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {!items.length && (
                  <div className="kanban-empty">
                    <CheckCircle2 size={24} />
                    <span>Nenhum pedido nesta etapa</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
