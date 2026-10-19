import { useState } from "react"
import { reversalSchema, type PaymentView } from "@cardapio/contracts"
import { can } from "@cardapio/domain/permissions"
import { formatMoney } from "@cardapio/domain/money"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import Dialog from "../../../shared/presentation/Dialog"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { InputField } from "../../../shared/presentation/Fields"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { financeTime, paymentLabels } from "./payment-labels"

export default function PaymentHistory({
  payments,
  restaurantId,
  onChanged,
  disabled = false,
}: {
  payments: PaymentView[]
  restaurantId: string
  onChanged(): void
  disabled?: boolean
}) {
  const account = useAccount(),
    services = useServices(),
    mutation = useMutation()
  const [selected, setSelected] = useState<PaymentView | null>(null)
  const [reason, setReason] = useState("")
  const reverse = can(account?.restaurant.role, "payments:reverse")
  if (!payments.length)
    return <p className="info-notice">Nenhum recebimento registrado neste período.</p>
  return (
    <>
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
              <th>Valor</th>
              <th>Situação</th>
              {reverse && <th>Ações</th>}
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
                <td>
                  <span
                    className={`finance-badge ${payment.reversedAt ? "is-reversed" : ""}`}
                  >
                    {payment.reversedAt ? "Revertido" : "Confirmado"}
                  </span>
                  {payment.reversedAt && (
                    <small>
                      {financeTime(payment.reversedAt)} · {payment.reversalReason}
                    </small>
                  )}
                </td>
                {reverse && (
                  <td>
                    {!payment.reversedAt && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={disabled}
                        onClick={() => {
                          mutation.clearError()
                          setReason("")
                          setSelected(payment)
                        }}
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
      {selected && (
        <Dialog
          title="Reverter recebimento"
          busy={mutation.pending}
          onClose={() => setSelected(null)}
        >
          <ValidatedForm
            className="payment-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!services.payments || disabled) return
              void mutation
                .run(
                  () => services.payments!.reverse(restaurantId, selected.id, reason),
                  "Recebimento revertido. Histórico preservado.",
                )
                .then((result) => {
                  if (result?.ok) {
                    setSelected(null)
                    onChanged()
                  }
                })
            }}
          >
            <p>
              Reverter <strong>{formatMoney(selected.amount)}</strong>
              {selected.orderId
                ? " reabre esse valor no saldo do pedido."
                : " retira esse valor do saldo de recebimentos."}{" "}
              O histórico será mantido.
            </p>
            <p className="field-help">
              Se houve devolução ao cliente, faça-a pelo meio combinado. Esta ação
              registra somente a correção no sistema.
            </p>
            <InputField
              label="Motivo da reversão"
              required
              minLength={5}
              maxLength={300}
              schema={reversalSchema.shape.reason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.pending}
            />
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setSelected(null)}
              >
                Manter recebimento
              </button>
              <button
                type="submit"
                className="danger-button"
                disabled={mutation.pending || disabled}
              >
                {mutation.pending ? "Revertendo…" : "Confirmar reversão"}
              </button>
            </div>
          </ValidatedForm>
        </Dialog>
      )}
    </>
  )
}
