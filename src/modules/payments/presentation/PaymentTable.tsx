import { memo } from "react"
import ReceiptButton from "../../printing/presentation/ReceiptButton"
import type { PaymentView, ReportRange } from "@cardapio/contracts"
import { paymentActivity } from "@cardapio/domain/payments"
import { formatMoney } from "@cardapio/domain/money"
import { financeTime, paymentLabels } from "./payment-labels"
function PaymentTable({
  payments,
  range,
  reverse,
  disabled,
  onReverse,
  restaurantId,
}: {
  payments: PaymentView[]
  range?: ReportRange
  reverse: boolean
  disabled: boolean
  onReverse(payment: PaymentView): void
  restaurantId?: string
}) {
  return (
    <div
      className="finance-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Histórico de recebimentos"
    >
      <table className="finance-table">
        <thead>
          <tr>
            <th>Recebido em</th>
            <th>Origem</th>
            <th>Forma</th>
            <th>Valor original</th>
            {range && (
              <>
                <th>Entrada no período (+)</th>
                <th>Reversão no período (−)</th>
              </>
            )}
            <th>Situação atual</th>
            {(reverse || restaurantId) && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{financeTime(payment.createdAt)}</td>
              <td>
                {payment.orderId
                  ? `Pedido #${payment.orderId.slice(0, 8).toUpperCase()}`
                  : "Avulso"}
                <small>{payment.description || "Registro manual"}</small>
              </td>
              <td>{paymentLabels[payment.method]}</td>
              <td>{formatMoney(payment.amount)}</td>
              {range && (
                <>
                  <td>{formatMoney(paymentActivity(payment, range).received)}</td>
                  <td>{formatMoney(paymentActivity(payment, range).reversed)}</td>
                </>
              )}
              <td>
                <span
                  className={`finance-badge ${payment.reversedAt ? "is-reversed" : ""}`}
                >
                  {payment.reversedAt ? "Revertido" : "Registro válido"}
                </span>
                {payment.reversedAt && (
                  <small>
                    {financeTime(payment.reversedAt)} · {payment.reversalReason}
                  </small>
                )}
              </td>
              {(reverse || restaurantId) && (
                <td>
                  {restaurantId && (
                    <ReceiptButton
                      restaurantId={restaurantId}
                      sourceId={payment.id}
                      kind="PAYMENT"
                      compact
                      disabled={disabled}
                    />
                  )}
                  {reverse && !payment.reversedAt && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={disabled}
                      onClick={() => onReverse(payment)}
                    >
                      Reverter
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default memo(PaymentTable)
