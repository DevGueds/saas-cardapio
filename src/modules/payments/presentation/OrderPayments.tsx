import { useCallback, useState } from "react"
import type { OrderView } from "@cardapio/contracts"
import { can } from "@cardapio/domain/permissions"
import { formatMoney } from "@cardapio/domain/money"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import PaymentForm from "./PaymentForm"
import PaymentHistory from "./PaymentHistory"
export default function OrderPayments({ order }: { order: OrderView }) {
  const { payments } = useServices(),
    account = useAccount()
  if (!payments || !can(account?.restaurant.role, "payments:read")) return null
  return (
    <FeatureBoundary label="Pagamentos do pedido" resetKeys={[order.id]}>
      <Balance key={order.id} order={order} />
    </FeatureBoundary>
  )
}
function Balance({ order }: { order: OrderView }) {
  const { payments } = useServices(),
    account = useAccount()
  const load = useCallback(
    () => payments!.balance(order.restaurantId, order.id),
    [payments, order.restaurantId, order.id],
  )
  const resource = useResource(load)
  const [editing, setEditing] = useState(false)
  const balance = resource.data
  return (
    <section className="order-payments">
      <h3>Recebimentos do pedido</h3>
      {resource.loading && <p role="status">Atualizando saldo…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {balance && (
        <>
          <dl className="order-details-totals">
            <div>
              <dt>Recebido</dt>
              <dd>{formatMoney(balance.paid)}</dd>
            </div>
            <div>
              <dt>
                {balance.outstanding === 0 ? "Pago integralmente" : "Saldo em aberto"}
              </dt>
              <dd>{formatMoney(balance.outstanding)}</dd>
            </div>
          </dl>
          {balance.cancelled && balance.paid > 0 && (
            <p className="info-notice">
              Este pedido foi cancelado e ainda possui recebimentos. O gerente deve
              conferir a devolução e a reversão.
            </p>
          )}
          {editing ? (
            <PaymentForm
              restaurantId={order.restaurantId}
              balance={balance}
              onRefresh={() => void resource.reload()}
              initialMethod={
                order.customer.payment === "Dinheiro"
                  ? "CASH"
                  : order.customer.payment === "Pix"
                    ? "PIX"
                    : "CREDIT"
              }
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                void resource.reload()
              }}
            />
          ) : (
            can(account?.restaurant.role, "payments:write") &&
            balance.outstanding > 0 &&
            !balance.cancelled && (
              <button
                type="button"
                className="primary-button"
                disabled={resource.loading || !!resource.error}
                onClick={() => setEditing(true)}
              >
                Registrar pagamento
              </button>
            )
          )}
          <PaymentHistory
            payments={balance.payments}
            restaurantId={order.restaurantId}
            onChanged={() => void resource.reload()}
            disabled={resource.loading || !!resource.error}
          />
        </>
      )}
    </section>
  )
}
