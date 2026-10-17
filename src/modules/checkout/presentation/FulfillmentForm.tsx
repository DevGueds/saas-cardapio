import { postalCodeField } from "@cardapio/contracts"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import { useState } from "react"
import type { CheckoutOptions } from "@cardapio/domain/quote"
import { emptyCommerce } from "@cardapio/domain/commerce"
import { normalizeName } from "@cardapio/domain/validation"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import ReferenceMap from "../../../app/presentation/ReferenceMap"
export default function FulfillmentForm({
  value,
  cep,
  onChange,
  onCep,
  onAddress,
  disabled,
}: {
  value: CheckoutOptions
  cep: string
  onChange(value: CheckoutOptions): void
  onCep(value: string): void
  onAddress(value: string): void
  disabled: boolean
}) {
  const { menu } = useMenu(),
    { maps } = useServices(),
    delivery = menu.commerce?.delivery ?? emptyCommerce().delivery,
    mutation = useMutation()
  const [notice, setNotice] = useState("")
  const fulfillment = value.fulfillment ?? { mode: "DELIVERY" },
    zones = delivery.zones.filter((z) => z.active),
    selected = zones.find((z) => z.id === fulfillment.zoneId)
  const cities = [...new Set(zones.map((z) => `${z.city} / ${z.state}`))].sort(),
    [city, setCity] = useState(selected ? `${selected.city} / ${selected.state}` : "")
  const currentCity = selected ? `${selected.city} / ${selected.state}` : city
  async function lookup() {
    if (!maps || !postalCodeField.safeParse(cep).success) return
    const result = await mutation.run(() => maps.lookup(cep.replace(/\D/g, "")))
    if (result?.ok) {
      const address = result.value,
        zone = zones.find(
          (z) =>
            z.state === address.state &&
            normalizeName(z.city) === normalizeName(address.city) &&
            normalizeName(z.neighborhood) === normalizeName(address.neighborhood),
        )
      onAddress(
        [address.street, address.neighborhood, address.city + " / " + address.state]
          .filter(Boolean)
          .join(", "),
      )
      setCity(`${address.city} / ${address.state}`)
      if (zone) onChange({ ...value, fulfillment: { mode: "DELIVERY", zoneId: zone.id } })
      else if (delivery.mode === "ZONES")
        onChange({ ...value, fulfillment: { mode: "DELIVERY" } })
      setNotice(
        zone || delivery.mode === "FLAT"
          ? "Endereço encontrado. Acrescente o número e o complemento abaixo."
          : "Confira se seu bairro está entre as regiões atendidas. A busca por CEP não garante a entrega.",
      )
    }
  }
  return (
    <fieldset className="fulfillment-form" disabled={disabled}>
      <h3>Como você quer receber?</h3>
      <div className="fulfillment-choices">
        {delivery.enabled && (
          <label>
            <ValidatedInput
              type="radio"
              name="fulfillment"
              checked={fulfillment.mode === "DELIVERY"}
              onChange={() => onChange({ ...value, fulfillment: { mode: "DELIVERY" } })}
            />
            <span>
              Entrega<small>Receba no seu endereço</small>
            </span>
          </label>
        )}
        {delivery.pickupEnabled && (
          <label>
            <ValidatedInput
              type="radio"
              name="fulfillment"
              checked={fulfillment.mode === "PICKUP"}
              onChange={() => onChange({ ...value, fulfillment: { mode: "PICKUP" } })}
            />
            <span>
              Retirada<small>Sem taxa de entrega</small>
            </span>
          </label>
        )}
      </div>
      {fulfillment.mode === "DELIVERY" && (
        <>
          {maps && (
            <div className="postal-search">
              <InputField
                label="CEP (opcional)"
                autoComplete="postal-code"
                inputMode="numeric"
                validation="cep"
                value={cep}
                maxLength={9}
                onChange={(e) => onCep(e.target.value)}
              />
              <button
                type="button"
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => void lookup()}
              >
                {mutation.pending ? "Buscando…" : "Buscar CEP"}
              </button>
            </div>
          )}
          {mutation.error && <ErrorNotice error={mutation.error} />}{" "}
          {notice && (
            <p className="field-help" role="status">
              {notice}
            </p>
          )}
          {delivery.mode === "ZONES" && (
            <div className="form-row">
              <SelectField
                label="Cidade de entrega"
                required
                value={currentCity}
                onChange={(e) => {
                  setCity(e.target.value)
                  onChange({ ...value, fulfillment: { mode: "DELIVERY" } })
                }}
              >
                <option value="">Selecione sua cidade</option>
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </SelectField>
              <SelectField
                label="Bairro de entrega"
                required
                value={fulfillment.zoneId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    fulfillment: { mode: "DELIVERY", zoneId: e.target.value },
                  })
                }
              >
                <option value="">Selecione seu bairro</option>
                {zones
                  .filter((z) => `${z.city} / ${z.state}` === currentCity)
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.neighborhood} · {formatMoney(z.fee)}
                    </option>
                  ))}
              </SelectField>
            </div>
          )}
          {selected && (
            <>
              <p className="field-help">
                Previsão: {selected.etaMin}–{selected.etaMax} minutos. Endereço fora desta
                região não é atendido nesta modalidade.
              </p>
              {selected.latitude !== null && selected.longitude !== null && (
                <ReferenceMap
                  latitude={selected.latitude}
                  longitude={selected.longitude}
                />
              )}
            </>
          )}
        </>
      )}
      {fulfillment.mode === "PICKUP" && (
        <div className="pickup-address">
          <strong>{menu.restaurant.name}</strong>
          <p>{menu.restaurant.address || "Combine o local da retirada com a loja."}</p>
          <small>Previsão de preparo: {delivery.pickupEta}</small>
        </div>
      )}
    </fieldset>
  )
}
