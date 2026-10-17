import { moneyField } from "@cardapio/contracts"
import { parseMoney, formatMoney } from "@cardapio/domain/money"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"
import ValidatedSelect from "../../../shared/presentation/form-validation/ValidatedSelect"
import type { DeliveryDetails, Payment } from "../domain/order-message"

export default function DeliveryForm({
  value,
  onChange,
  disabled,
  pickup = false,
  total,
}: {
  value: DeliveryDetails
  onChange(value: DeliveryDetails): void
  disabled: boolean
  pickup?: boolean
  total?: number
}) {
  function update<K extends keyof DeliveryDetails>(key: K, next: DeliveryDetails[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <fieldset disabled={disabled} className="delivery-fields">
      <div className="checkout-section">
        <div className="checkout-title">
          <span>2</span>
          <h3>{pickup ? "Quem vai retirar?" : "Dados para entrega"}</h3>
        </div>
        <div className="form-fields">
          <label className="field">
            <span>Seu nome completo *</span>
            <ValidatedInput
              required
              autoComplete="name"
              placeholder="Como podemos chamar você?"
              maxLength={120}
              validation="personName"
              value={value.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Seu WhatsApp com DDD *</span>
            <ValidatedInput
              required
              type="tel"
              autoComplete="tel"
              maxLength={30}
              placeholder="(11) 99999-9999"
              value={value.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          {!pickup && (
            <label className="field">
              <span>Endereço de entrega completo *</span>
              <ValidatedTextarea
                required
                rows={2}
                autoComplete="street-address"
                placeholder="Rua, número, bairro e complemento"
                maxLength={500}
                value={value.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>
              {pickup ? "Observações para retirada" : "Observações para entrega"}
            </span>
            <ValidatedInput
              maxLength={500}
              placeholder="Ex.: tocar o interfone do apartamento 12"
              value={value.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="checkout-section">
        <div className="checkout-title">
          <span>3</span>
          <h3>Forma de pagamento</h3>
        </div>
        <label className="field">
          <span>Pagamento</span>
          <ValidatedSelect
            value={value.payment}
            onChange={(event) => update("payment", event.target.value as Payment)}
          >
            <option>Pix</option>
            <option>Cartão na Entrega</option>
            <option>Dinheiro</option>
          </ValidatedSelect>
        </label>
        <p className="field-help payment-help">
          O pagamento será combinado diretamente com a loja.
        </p>
        {value.payment === "Dinheiro" && (
          <label className="field cash-field">
            <span>Precisa de troco para quanto?</span>
            <ValidatedInput
              inputMode="decimal"
              placeholder="100,00"
              validation="money"
              maxLength={20}
              schema={moneyField(true, true).superRefine((v, ctx) => {
                if (
                  v.trim() &&
                  moneyField(true).safeParse(v).success &&
                  total !== undefined &&
                  parseMoney(v) < total
                )
                  ctx.addIssue({
                    code: "custom",
                    message: `O valor para troco deve cobrir o total de ${formatMoney(total)}.`,
                  })
              })}
              value={value.cashChange}
              onChange={(event) => update("cashChange", event.target.value)}
            />
          </label>
        )}
      </div>
    </fieldset>
  )
}
