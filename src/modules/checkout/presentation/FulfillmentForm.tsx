import type { PostalAddress } from "@cardapio/contracts"
import type { DeliveryAddress } from "@cardapio/domain/delivery-address"
import PostalCodeLookup from "../../../app/presentation/PostalCodeLookup"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import { useMemo, useState } from "react"
import type { CheckoutOptions } from "@cardapio/domain/quote"
import { emptyCommerce } from "@cardapio/domain/commerce"
import { normalizeName } from "@cardapio/domain/validation"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { SelectField } from "../../../shared/presentation/Fields"
import ReferenceMap from "../../../app/presentation/ReferenceMap"
export default function FulfillmentForm({
  value,
  cep,
  address,
  onChange,
  onCep,
  onAddress,
  disabled,
}: {
  value: CheckoutOptions
  cep: string
  address: DeliveryAddress
  onChange(value: CheckoutOptions): void
  onCep(value: string): void
  onAddress(value: PostalAddress): void
  disabled: boolean
}) {
  const { menu } = useMenu(),
    delivery = menu.commerce?.delivery ?? emptyCommerce().delivery
  const [notice, setNotice] = useState("")
  const fulfillment = value.fulfillment ?? { mode: "DELIVERY" },
    zones = useMemo(() => delivery.zones.filter((z) => z.active), [delivery.zones]),
    selected = zones.find((z) => z.id === fulfillment.zoneId)
  const cities = useMemo(
      () => [...new Set(zones.map((z) => `${z.city} / ${z.state}`))].sort(),
      [zones],
    ),
    [city, setCity] = useState(selected ? `${selected.city} / ${selected.state}` : "")
  const currentCity = selected ? `${selected.city} / ${selected.state}` : city
  function found(found: PostalAddress) {
    const zone = zones.find(
      (zone) =>
        zone.state === found.state &&
        normalizeName(zone.city) === normalizeName(found.city) &&
        normalizeName(zone.neighborhood) === normalizeName(found.neighborhood),
    )
    onAddress(found)
    setCity(zone ? `${zone.city} / ${zone.state}` : "")
    if (delivery.mode === "ZONES")
      onChange({
        ...value,
        fulfillment: { mode: "DELIVERY", ...(zone ? { zoneId: zone.id } : {}) },
      })
    setNotice(
      zone || delivery.mode !== "ZONES"
        ? "Endereço localizado. Confira rua, número e complemento; o CEP não identifica a entrada do imóvel."
        : "O CEP não corresponde a um bairro atendido. Confira as regiões disponíveis; a busca não garante a entrega.",
    )
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
          <PostalCodeLookup
            value={cep}
            onChange={onCep}
            onFound={found}
            disabled={disabled}
            section="customer"
            contextKey={JSON.stringify({
              address: { ...address, postalCode: undefined },
              mode: fulfillment.mode,
              zone: fulfillment.zoneId,
              revision: menu.revision,
              selectedCity: city,
            })}
          />
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
          {delivery.mode === "RADIUS" && (
            <p className="field-help">
              Preencha o endereço e confirme o ponto de entrega abaixo. O frete será
              calculado automaticamente pela faixa de distância. O CEP ajuda a preencher o
              endereço, mas não define o ponto exato.
            </p>
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
