import { useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { z } from "zod"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  parseKilometers,
  parseRadiusDelivery,
  type GeoPoint,
  type RadiusBand,
  type RadiusDelivery,
} from "@cardapio/domain/delivery-radius"
import { formatMoney, moneyInput, parseMoney } from "@cardapio/domain/money"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import LocationPicker from "../../../app/presentation/LocationPicker"
import Dialog from "../../../shared/presentation/Dialog"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { InputField, FormActions } from "../../../shared/presentation/Fields"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"

const empty: RadiusDelivery = { origin: null, bands: [] }
const draftSchema = z.strictObject({
  id: z.string(),
  kilometers: z.string().max(20),
  fee: z.string().max(20),
})
const kilometersSchema = z.string().refine((value) => {
  try {
    parseKilometers(value)
    return true
  } catch {
    return false
  }
}, "Informe entre 0,001 e 100 km, com até três casas decimais.")
const km = (meters: number) =>
  (meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })
export default function RadiusSettings({
  value = empty,
  onChange,
  disabled,
  address,
}: {
  value?: RadiusDelivery
  onChange(value: RadiusDelivery): void
  disabled: boolean
  address: string
}) {
  const [editor, setEditor] = useState<{ band?: RadiusBand } | null>(null),
    [deleting, setDeleting] = useState<RadiusBand | null>(null)
  const bands = useMemo(
    () => [...value.bands].sort((a, b) => a.maxMeters - b.maxMeters),
    [value.bands],
  )
  const changeOrigin = useCallback(
    (origin: GeoPoint | null) => onChange({ ...value, origin }),
    [value, onChange],
  )
  return (
    <section className="delivery-regions radius-settings">
      <h2>Entrega por raio de distância</h2>
      <p>
        A taxa é fixa em cada faixa e não se acumula. Distância em linha reta, arredondada
        ao metro mais próximo; não é distância por ruas.
      </p>
      <p className="field-help">
        Saída: {address || "Cadastre também o endereço nas configurações da loja."}
      </p>
      <LocationPicker
        title="Ponto de saída da loja"
        value={value.origin}
        onChange={changeOrigin}
        disabled={disabled}
      />
      <div className="section-heading">
        <div>
          <h3>Faixas de frete</h3>
          <p>Até 20 faixas. Fora do maior raio, a entrega fica indisponível.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={disabled || bands.length >= 20}
          onClick={() => setEditor({})}
        >
          <Plus size={18} /> Adicionar faixa
        </button>
      </div>
      <div className="region-list">
        {bands.map((band, index) => (
          <article key={band.id} className="region-card">
            <div>
              <h3>Até {km(band.maxMeters)} km</h3>
              <p>
                {index === 0
                  ? "A partir da loja"
                  : `Acima de ${km(bands[index - 1]!.maxMeters)} km`}{" "}
                · limite superior incluído
              </p>
            </div>
            <strong>{formatMoney(band.fee)}</strong>
            <div className="region-actions">
              <button
                type="button"
                className="icon-button"
                disabled={disabled}
                aria-label={`Editar faixa até ${km(band.maxMeters)} km`}
                onClick={() => setEditor({ band })}
              >
                <Pencil size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={disabled}
                aria-label={`Remover faixa até ${km(band.maxMeters)} km`}
                onClick={() => setDeleting(band)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!bands.length && (
        <p className="info-notice">
          Adicione pelo menos uma faixa para publicar o frete por raio.
        </p>
      )}
      <p className="field-help">
        Confirme o ponto da loja e salve as entregas para publicar. Novas taxas valem para
        novos pedidos; pedidos registrados preservam a taxa original.
      </p>
      {editor &&
        createPortal(
          <RadiusBandForm
            band={editor.band}
            radius={value}
            onClose={() => setEditor(null)}
            onSave={onChange}
          />,
          document.body,
        )}
      {deleting &&
        createPortal(
          <Dialog title="Remover faixa de entrega" onClose={() => setDeleting(null)}>
            <div className="editor-form">
              <p>
                Remover o limite de {km(deleting.maxMeters)} km? Os pontos dessa faixa
                passarão para a próxima faixa ou ficarão fora da área atendida. A mudança
                será publicada ao salvar.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setDeleting(null)}
                >
                  Manter faixa
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={disabled}
                  onClick={() => {
                    onChange({
                      ...value,
                      bands: bands.filter((b) => b.id !== deleting.id),
                    })
                    setDeleting(null)
                  }}
                >
                  Remover faixa
                </button>
              </div>
            </div>
          </Dialog>,
          document.body,
        )}
    </section>
  )
}
function RadiusBandForm({
  band,
  radius,
  onSave,
  onClose,
}: {
  band?: RadiusBand
  radius: RadiusDelivery
  onSave(radius: RadiusDelivery): void
  onClose(): void
}) {
  const { ids } = useServices(),
    mutation = useMutation()
  const [id] = useState(() => band?.id ?? ids.next())
  const draft = useFormDraft(
    `radius-band:${band?.id ?? "new"}`,
    { id, kilometers: band ? km(band.maxMeters) : "", fee: moneyInput(band?.fee ?? 0) },
    draftSchema.parse,
  )
  return (
    <Dialog
      title={band ? "Editar faixa de frete" : "Adicionar faixa de frete"}
      onClose={onClose}
      busy={mutation.pending}
    >
      <ValidatedForm
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void mutation.run(async () => {
            const next = {
              id: draft.value.id,
              maxMeters: parseKilometers(draft.value.kilometers),
              fee: parseMoney(draft.value.fee, "fee"),
            }
            const updated = parseRadiusDelivery({
              ...radius,
              bands: [...radius.bands.filter((b) => b.id !== next.id), next],
            })
            onSave(updated)
            draft.clear()
            onClose()
            return { ok: true, value: null }
          })
        }}
      >
        <DraftNotice draft={draft} />
        <p>A taxa vale para toda a faixa, sem multiplicar pelos quilômetros.</p>
        <InputField
          label="Raio máximo da faixa (km)"
          required
          inputMode="decimal"
          maxLength={20}
          schema={kilometersSchema}
          value={draft.value.kilometers}
          onChange={(e) => draft.set((v) => ({ ...v, kilometers: e.target.value }))}
          help="Exemplo: 2,5 significa até 2.500 metros da loja."
        />
        <InputField
          label="Taxa da faixa (R$)"
          required
          inputMode="decimal"
          validation="money"
          maxLength={20}
          value={draft.value.fee}
          onChange={(e) => draft.set((v) => ({ ...v, fee: e.target.value }))}
        />
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <FormActions
          busy={mutation.pending}
          onCancel={onClose}
          label="Adicionar à lista"
        />
      </ValidatedForm>
    </Dialog>
  )
}
