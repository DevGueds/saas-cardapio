import type { OrderStatus, OrderView } from "@cardapio/contracts"
import { Clock3, ArrowRight } from "lucide-react"
import { formatMoney } from "../../../shared/domain/money"
import { nextStep, orderTime, shortOrder } from "./order-labels"
export default function OrderCard({
  order,
  disabled,
  onDetails,
  onTransition,
}: {
  order: OrderView
  disabled: boolean
  onDetails(): void
  onTransition(status: OrderStatus): void
}) {
  const action = nextStep[order.status]
  return (
    <article className="live-order-card">
      <header>
        <strong>#{shortOrder(order.id)}</strong>
        <span>
          <Clock3 size={14} aria-hidden="true" />
          {orderTime(order.createdAt)}
        </span>
      </header>
      <h3>{order.customer.name}</h3>
      <ul>
        {order.items.slice(0, 3).map((item) => (
          <li key={item.productId}>
            <strong>{item.quantity}×</strong> {item.name}
          </li>
        ))}
      </ul>
      {order.items.length > 3 && (
        <small>+ {order.items.length - 3} itens no pedido</small>
      )}
      <div className="live-order-total">
        <span>{order.customer.payment}</span>
        <strong>{formatMoney(order.total)}</strong>
      </div>
      <button className="secondary-button" onClick={onDetails}>
        Ver detalhes
      </button>
      {action && (
        <button
          className="primary-button"
          disabled={disabled}
          onClick={() => onTransition(action.status)}
        >
          {action.label}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </article>
  )
}
