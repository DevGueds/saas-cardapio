import { can, canAdvance } from "@cardapio/domain/permissions"
import OrderPayments from "../../payments/presentation/OrderPayments"
import { useAccount } from "../../identity/presentation/AccountContext"
import CourierAssignment from "./CourierAssignment"
import ReferenceMap from "../../../app/presentation/ReferenceMap"
import { useState } from "react"
import type { OrderView } from "@cardapio/contracts"
import type { AppError } from "../../../shared/application/result"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
import { formatMoney } from "../../../shared/domain/money"
import { orderLabels, orderTime, shortOrder } from "./order-labels"
import { deliveryAddressLines } from "@cardapio/domain/delivery-address"
export default function OrderDetails({
  order,
  disabled,
  busy,
  error,
  onRetry,
  onClose,
  onCancel,
}: {
  order: OrderView
  disabled: boolean
  busy: boolean
  error: AppError | null
  onRetry(): void
  onClose(): void
  onCancel(): void
}) {
  const [confirming, setConfirming] = useState(false)
  const account = useAccount()
  const cancellable =
    ["NEW", "PREPARING", "READY"].includes(order.status) &&
    !!account &&
    canAdvance(account.restaurant.role, "CANCELLED")
  return (
    <Dialog title={`Pedido #${shortOrder(order.id)}`} onClose={onClose} busy={busy}>
      <div className="order-details">
        {error && <ErrorNotice error={error} onRetry={onRetry} />}
        <p className="eyebrow">
          {orderLabels[order.status]} · {orderTime(order.createdAt)}
        </p>
        <section>
          <h3>Cliente e entrega</h3>
          <p>
            <strong>{order.customer.name}</strong>
          </p>
          <p>{order.customer.phone}</p>
          {order.customer.deliveryAddress ? (
            <address className="order-delivery-address">
              {deliveryAddressLines(order.customer.deliveryAddress).map((line, index) => (
                <p key={index}>{index === 0 ? <strong>{line}</strong> : line}</p>
              ))}
            </address>
          ) : (
            <p>{order.customer.address}</p>
          )}
          {order.fulfillment?.radius && (
            <p className="field-help">
              {order.region}. Taxa registrada: {formatMoney(order.fulfillment.radius.fee)}{" "}
              antes dos descontos.
            </p>
          )}
          {order.fulfillment?.destination && (
            <ReferenceMap
              label="Ver ponto de entrega"
              help="Ponto confirmado pelo cliente na criação do pedido. A taxa registrada usa a distância em linha reta até a loja; o mapa não mostra o entregador."
              latitude={order.fulfillment.destination.latitude}
              longitude={order.fulfillment.destination.longitude}
            />
          )}
          {order.customer.notes && <p className="info-notice">{order.customer.notes}</p>}
        </section>
        <section>
          <h3>Itens do pedido</h3>
          <ul>
            {order.items.map((item, index) => (
              <li key={index}>
                <div>
                  <strong>
                    {item.quantity}× {item.name}
                  </strong>
                  <span>{formatMoney(item.quantity * item.unitPrice)}</span>
                </div>
                {item.components?.map((c, n) => (
                  <small className="combo-component" key={n}>
                    {c}
                  </small>
                ))}
                {item.note && <p>{item.note}</p>}
              </li>
            ))}
          </ul>
        </section>
        <dl className="order-details-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>{formatMoney(order.deliveryFee)}</dd>
          </div>
          {!!order.discount && (
            <div>
              <dt>{order.promotionName ?? "Desconto"}</dt>
              <dd>−{formatMoney(order.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd>
              <strong>{formatMoney(order.total)}</strong>
            </dd>
          </div>
        </dl>
        <section>
          <h3>Pagamento combinado</h3>
          <p>{order.customer.payment}</p>
          {order.customer.payment === "Dinheiro" && order.customer.cashChange && (
            <p>Troco para R$ {order.customer.cashChange}</p>
          )}
          <p className="field-help">
            Forma escolhida pelo cliente. A baixa depende da confirmação manual de quem
            recebeu.
          </p>
        </section>
        <OrderPayments order={order} />
        {account &&
          can(account.restaurant.role, "orders:dispatch") &&
          order.fulfillment?.mode !== "PICKUP" &&
          ["NEW", "PREPARING", "READY"].includes(order.status) && (
            <CourierAssignment
              key={`${order.id}:${order.revision}`}
              order={order}
              onSaved={onRetry}
            />
          )}
        {order.history && (
          <section>
            <h3>Histórico</h3>
            <ul className="order-history">
              {order.history.map((event, index) => (
                <li key={index}>
                  <strong>{orderLabels[event.status]}</strong>
                  <time>{orderTime(event.at)}</time>
                </li>
              ))}
            </ul>
          </section>
        )}
        {cancellable &&
          (confirming ? (
            <div className="info-notice">
              <strong>Cancelar este pedido?</strong>
              <p>
                Esta ação encerra o pedido. Combine o cancelamento diretamente com o
                cliente. Recebimentos já registrados permanecem no histórico e precisam de
                reversão pelo gerente, quando cabível.
              </p>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  disabled={disabled}
                  onClick={() => setConfirming(false)}
                >
                  Manter pedido
                </button>
                <button className="danger-button" disabled={disabled} onClick={onCancel}>
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          ) : (
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => setConfirming(true)}
            >
              Cancelar pedido
            </button>
          ))}
      </div>
    </Dialog>
  )
}
