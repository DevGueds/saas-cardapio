import { ArrowRight, CheckCircle2, Clock3, MessageCircleOff, Truck } from "lucide-react"
import { formatMoney } from "../../../shared/domain/money"
import type { DemoOrder } from "../domain/demo-order"

export default function DemoOrderCard({
  order,
  onAdvance,
}: {
  order: DemoOrder
  onAdvance(): void
}) {
  return (
    <article
      className="order-card"
      id={`demo-order-${order.id}`}
      tabIndex={-1}
      aria-label={`Pedido #${order.id}`}
    >
      <header className="order-card__top">
        <div>
          <span>Pedido</span>
          <h3>#{order.id}</h3>
        </div>
        <span className="order-time">
          <Clock3 size={14} aria-hidden="true" />
          {order.time}
          <span className="sr-only"> (tempo de exemplo)</span>
        </span>
      </header>
      <div className="order-customer">
        <span className="customer-avatar" aria-hidden="true">
          {order.customer
            .split(" ")
            .map((name) => name[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <strong>{order.customer}</strong>
          <small>Cliente de exemplo</small>
        </div>
        <button
          disabled
          type="button"
          aria-label="Contato indisponível na demonstração"
          title="Contato indisponível na demonstração"
        >
          <MessageCircleOff size={17} aria-hidden="true" />
        </button>
      </div>
      <ul className="order-items">
        {order.items.map((item) => {
          const [quantity, ...description] = item.split(" ")
          return (
            <li key={item}>
              <span>{quantity}</span>
              <span>{description.join(" ")}</span>
            </li>
          )
        })}
      </ul>
      <div className="order-payment">
        <span>
          Total do pedido<strong>{formatMoney(order.total)}</strong>
        </span>
        <span className={`payment-pill payment-pill--${order.paymentStatus}`}>
          {order.paymentStatus === "confirmed" && (
            <CheckCircle2 size={13} aria-hidden="true" />
          )}
          {order.paymentMethod}
          <small>
            {order.paymentStatus === "confirmed"
              ? "Pago (simulado)"
              : "Pendente (exemplo)"}
          </small>
        </span>
      </div>
      {order.status !== "delivery" ? (
        <button type="button" className="order-advance" onClick={onAdvance}>
          {order.status === "new" ? "Iniciar preparo" : "Enviar para entrega"}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <div className="order-in-delivery">
          <Truck size={17} aria-hidden="true" />
          Em rota de entrega
        </div>
      )}
    </article>
  )
}
