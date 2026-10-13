import type { DeliveryDetails, Payment } from "../domain/order-message"

export default function DeliveryForm({
  value,
  onChange,
  disabled,
}: {
  value: DeliveryDetails
  onChange(value: DeliveryDetails): void
  disabled: boolean
}) {
  function update<K extends keyof DeliveryDetails>(key: K, next: DeliveryDetails[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <fieldset disabled={disabled} className="delivery-fields">
      <div className="checkout-section">
        <div className="checkout-title">
          <span>1</span>
          <h3>Dados para entrega</h3>
        </div>
        <div className="form-fields">
          <label className="field">
            <span>Seu nome completo *</span>
            <input
              required
              autoComplete="name"
              maxLength={120}
              value={value.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Seu WhatsApp com DDD *</span>
            <input
              required
              type="tel"
              autoComplete="tel"
              maxLength={30}
              placeholder="(11) 99999-9999"
              value={value.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Endereço de entrega completo *</span>
            <textarea
              required
              rows={2}
              autoComplete="street-address"
              maxLength={500}
              value={value.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Observações para entrega</span>
            <input
              maxLength={500}
              value={value.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="checkout-section">
        <div className="checkout-title">
          <span>2</span>
          <h3>Forma de pagamento</h3>
        </div>
        <label className="field">
          <span>Pagamento</span>
          <select
            value={value.payment}
            onChange={(event) => update("payment", event.target.value as Payment)}
          >
            <option>Pix</option>
            <option>Cartão na Entrega</option>
            <option>Dinheiro</option>
          </select>
        </label>
        {value.payment === "Dinheiro" && (
          <label className="field cash-field">
            <span>Precisa de troco para quanto?</span>
            <input
              inputMode="decimal"
              placeholder="100,00"
              value={value.cashChange}
              onChange={(event) => update("cashChange", event.target.value)}
            />
          </label>
        )}
      </div>
    </fieldset>
  )
}
