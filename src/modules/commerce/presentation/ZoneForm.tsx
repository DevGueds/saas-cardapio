import { coordinateField, integerTextField } from "@cardapio/contracts"
import PostalCodeLookup from "../../../app/presentation/PostalCodeLookup"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { type FormEvent } from "react"
import type { DeliveryZone } from "@cardapio/domain/commerce"
import { parseDelivery } from "@cardapio/domain/commerce"
import { moneyInput, parseMoney } from "@cardapio/domain/money"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import {
  InputField,
  SelectField,
  ToggleField,
  FormActions,
} from "../../../shared/presentation/Fields"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
import ReferenceMap from "../../../app/presentation/ReferenceMap"
import { zoneDraftSchema, states } from "../application/delivery-drafts"
export default function ZoneForm({
  zone,
  onClose,
  onAdd,
}: {
  zone?: DeliveryZone
  onClose(): void
  onAdd(zone: DeliveryZone): void
}) {
  const { ids } = useServices(),
    mutation = useMutation()
  const draft = useFormDraft(
    `zone:${zone?.id ?? "new"}`,
    {
      id: zone?.id ?? ids.next(),
      state: zone?.state ?? "",
      city: zone?.city ?? "",
      neighborhood: zone?.neighborhood ?? "",
      fee: moneyInput(zone?.fee ?? 0),
      etaMin: String(zone?.etaMin ?? 30),
      etaMax: String(zone?.etaMax ?? 60),
      active: zone?.active ?? true,
      latitude: zone?.latitude?.toString() ?? "",
      longitude: zone?.longitude?.toString() ?? "",
      cep: "",
    },
    zoneDraftSchema.parse,
  )
  const value = draft.value,
    field = <K extends keyof typeof value>(key: K, next: (typeof value)[K]) =>
      draft.set((v) => ({ ...v, [key]: next }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await mutation.run(async () => {
      const parsed = parseDelivery({
        enabled: true,
        pickupEnabled: false,
        mode: "ZONES",
        pickupEta: "30 min",
        zones: [
          {
            id: value.id,
            state: value.state,
            city: value.city,
            neighborhood: value.neighborhood,
            fee: parseMoney(value.fee, "fee"),
            etaMin: Number(value.etaMin),
            etaMax: Number(value.etaMax),
            active: value.active,
            latitude: value.latitude === "" ? null : Number(value.latitude),
            longitude: value.longitude === "" ? null : Number(value.longitude),
          },
        ],
      })
      onAdd(parsed.zones[0]!)
      return { ok: true as const, value: null }
    })
    if (result?.ok) {
      draft.clear()
      onClose()
    }
  }
  return (
    <Dialog
      title={zone ? "Editar bairro" : "Adicionar bairro"}
      onClose={onClose}
      busy={mutation.pending}
    >
      <ValidatedForm className="editor-form" onSubmit={(e) => void submit(e)}>
        <DraftNotice draft={draft} />
        <p className="form-intro">
          Defina o bairro atendido, o frete e a previsão. Cidades próximas podem ter seus
          próprios bairros.
        </p>
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <fieldset disabled={mutation.pending}>
          <PostalCodeLookup
            label="Preencher pelo CEP (opcional)"
            section="zone"
            help="Ao sair do campo, buscamos cidade e bairro. Confira a região antes de salvar."
            value={value.cep}
            onChange={(cep) => field("cep", cep)}
            disabled={mutation.pending}
            contextKey={JSON.stringify({ ...value, cep: undefined })}
            onFound={(address) =>
              draft.set((v) => ({
                ...v,
                state: address.state,
                city: address.city,
                neighborhood: address.neighborhood,
                latitude: address.latitude?.toString() ?? "",
                longitude: address.longitude?.toString() ?? "",
              }))
            }
          />
          <div className="form-row">
            <SelectField
              label="Estado"
              required
              value={value.state}
              onChange={(e) => field("state", e.target.value)}
            >
              <option value="">Selecione</option>
              {states.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </SelectField>
            <InputField
              label="Cidade"
              required
              maxLength={120}
              validation="name"
              value={value.city}
              onChange={(e) => field("city", e.target.value)}
            />
          </div>
          <InputField
            label="Bairro"
            required
            maxLength={120}
            validation="name"
            value={value.neighborhood}
            onChange={(e) => field("neighborhood", e.target.value)}
          />
          <InputField
            label="Taxa de entrega (R$)"
            required
            inputMode="decimal"
            maxLength={20}
            validation="money"
            value={value.fee}
            onChange={(e) => field("fee", e.target.value)}
          />
          <div className="form-row">
            <InputField
              label="Prazo mínimo (minutos)"
              required
              type="number"
              min={1}
              max={1440}
              value={value.etaMin}
              onChange={(e) => field("etaMin", e.target.value)}
            />
            <InputField
              label="Prazo máximo (minutos)"
              required
              type="number"
              min={1}
              max={1440}
              schema={integerTextField(1, 1440).refine(
                (v) => Number(v) >= Number(value.etaMin),
                "O prazo máximo deve ser igual ou maior que o mínimo.",
              )}
              value={value.etaMax}
              onChange={(e) => field("etaMax", e.target.value)}
            />
          </div>
          <ToggleField
            label="Bairro atendido"
            checked={value.active}
            onChange={(v) => field("active", v)}
          />
          <details className="offer-section">
            <summary>Referência no mapa (opcional)</summary>
            <ReferenceMap
              latitude={value.latitude ? Number(value.latitude) : null}
              longitude={value.longitude ? Number(value.longitude) : null}
              onSelect={(latitude, longitude) =>
                draft.set((v) => ({
                  ...v,
                  latitude: String(latitude),
                  longitude: String(longitude),
                }))
              }
            />
            <div className="form-row">
              <InputField
                label="Latitude"
                inputMode="decimal"
                validation="coordinate"
                maxLength={20}
                schema={coordinateField(90).refine(
                  (v) => !!v || !value.longitude.trim(),
                  "Preencha também a latitude ou apague a longitude.",
                )}
                value={value.latitude}
                onChange={(e) => field("latitude", e.target.value)}
              />
              <InputField
                label="Longitude"
                inputMode="decimal"
                validation="coordinate"
                maxLength={20}
                schema={coordinateField(180).refine(
                  (v) => !!v || !value.latitude.trim(),
                  "Preencha também a longitude ou apague a latitude.",
                )}
                value={value.longitude}
                onChange={(e) => field("longitude", e.target.value)}
              />
            </div>
          </details>
        </fieldset>
        <FormActions
          busy={mutation.pending}
          onCancel={onClose}
          label="Adicionar à lista"
        />
      </ValidatedForm>
    </Dialog>
  )
}
