import { useState, type FormEvent } from "react"
import { z } from "zod"
import {
  paymentMethodSchema,
  moneyField,
  uuid,
  type OrderBalance,
  type PaymentMethod,
} from "@cardapio/contracts"
import { moneyInput } from "@cardapio/domain/money"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { notifyInfo, notifySuccess } from "../../../shared/presentation/notify"
import { paymentLabels } from "./payment-labels"

const draftSchema = z.strictObject({
  requestId: uuid,
  amount: z.string().max(30),
  method: paymentMethodSchema.or(z.literal("")),
  description: z.string().max(160),
  expectedPaid: z.number().int().min(0),
  submitted: z.boolean(),
})
export default function PaymentForm({
  restaurantId,
  balance,
  initialMethod = "PIX",
  onSaved,
  onCancel,
  onRefresh,
}: {
  restaurantId: string
  balance?: OrderBalance
  initialMethod?: PaymentMethod | ""
  onSaved(): void
  onCancel(): void
  onRefresh?(): void
}) {
  const { payments, ids } = useServices()
  const mutation = useMutation()
  const [initial] = useState(() => ({
    requestId: ids.next(),
    amount: balance ? moneyInput(balance.outstanding) : "",
    method: initialMethod,
    description: "",
    expectedPaid: balance?.paid ?? 0,
    submitted: false,
  }))
  const draft = useFormDraft(
    `payment:${balance?.orderId ?? "standalone"}`,
    initial,
    draftSchema.parse,
  )
  const value = draft.value
  const locked = mutation.pending || value.submitted
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!payments || mutation.pending || draft.issue || !value.method) return
    // Persist the request identity BEFORE the network call, including across reloads.
    if (!draft.set({ ...value, submitted: true })) return
    const { submitted: _submitted, ...data } = value
    const result = await mutation.run(() =>
      payments.record(restaurantId, {
        ...data,
        method: value.method as PaymentMethod,
        orderId: balance?.orderId ?? null,
      }),
    )
    if (result?.ok) {
      if (result.value.reversedAt)
        notifyInfo(
          "A tentativa já estava registrada e foi revertida. Confira o histórico; nenhum novo recebimento foi criado.",
        )
      else
        notifySuccess(
          balance
            ? "Recebimento registrado. Saldo do pedido atualizado."
            : "Recebimento avulso registrado.",
        )
      draft.reset({ ...initial, requestId: ids.next() })
      onSaved()
    } else if (
      result &&
      ["VALIDATION", "CONFLICT", "NOT_FOUND", "ACCESS_DENIED"].includes(result.error.code)
    ) {
      draft.set({ ...value, submitted: false })
    }
  }
  return (
    <ValidatedForm className="payment-form" onSubmit={(event) => void submit(event)}>
      <h3>
        {balance ? "Registrar pagamento do pedido" : "Registrar recebimento avulso"}
      </h3>
      <p className="field-help">
        Confirme apenas valores já recebidos. Este registro manual não movimenta dinheiro
        em bancos ou cartões.
      </p>
      <p className="field-help">
        {balance
          ? "Em dinheiro, registre o valor que fica com a loja, descontando o troco. Para pagamento parcial, informe só a parcela recebida."
          : "Avulsos entram nos recebimentos, sem criar uma venda ou quitar um pedido. Para dar baixa em um pedido, use os detalhes dele."}
      </p>
      {draft.issue && (
        <p className="error-notice" role="alert">
          {draft.issue}
        </p>
      )}
      {value.submitted && !mutation.pending && (
        <p className="info-notice">
          A confirmação anterior ainda precisa ser verificada. Use “Verificar recebimento”
          para consultar ou concluir a mesma tentativa, sem duplicar o registro.
        </p>
      )}
      {mutation.error && <ErrorNotice error={mutation.error} onRetry={onRefresh} />}
      {balance && !value.submitted && value.expectedPaid !== balance.paid && (
        <div className="info-notice">
          <p>
            O saldo foi atualizado por outra operação. Confira o valor antes de confirmar.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              draft.set({
                ...value,
                expectedPaid: balance.paid,
                amount: moneyInput(balance.outstanding),
                requestId: ids.next(),
              })
            }
          >
            Usar saldo atualizado
          </button>
        </div>
      )}
      <fieldset disabled={locked}>
        <div className="finance-form-grid">
          <InputField
            label="Valor recebido (R$)"
            required
            inputMode="decimal"
            validation="money"
            schema={moneyField(true)}
            maxLength={30}
            value={value.amount}
            onChange={(e) => draft.set({ ...value, amount: e.target.value })}
          />
          <SelectField
            label="Forma de recebimento"
            required
            value={value.method}
            onChange={(e) =>
              draft.set({ ...value, method: e.target.value as PaymentMethod })
            }
          >
            <option value="" disabled>
              Selecione a forma recebida
            </option>
            {Object.entries(paymentLabels).map(([method, label]) => (
              <option key={method} value={method}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <InputField
          label={balance ? "Descrição (opcional)" : "Descrição do recebimento"}
          required={!balance}
          maxLength={160}
          help="Ex.: venda no balcão. Não inclua dados pessoais ou de cartão."
          value={value.description}
          onChange={(e) => draft.set({ ...value, description: e.target.value })}
        />
      </fieldset>
      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={mutation.pending}
          onClick={onCancel}
        >
          Voltar
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={mutation.pending || !!draft.issue}
        >
          {mutation.pending
            ? "Confirmando…"
            : value.submitted
              ? "Verificar recebimento"
              : "Confirmar recebimento"}
        </button>
      </div>
    </ValidatedForm>
  )
}
