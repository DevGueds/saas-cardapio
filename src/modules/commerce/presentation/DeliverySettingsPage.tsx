import { notifySuccess } from "../../../shared/presentation/notify"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { useState, type FormEvent } from "react"
import { Bike, MapPin, Plus, Pencil, Trash2, Store } from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import { emptyCommerce, type DeliveryZone } from "@cardapio/domain/commerce"
import { normalizeName } from "@cardapio/domain/validation"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import PageHeading from "../../../shared/presentation/PageHeading"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import Dialog from "../../../shared/presentation/Dialog"
import {
  InputField,
  SelectField,
  ToggleField,
  FormActions,
} from "../../../shared/presentation/Fields"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { deliveryDraftSchema } from "../application/delivery-drafts"
import ZoneForm from "./ZoneForm"
export default function DeliverySettingsPage() {
  const { menu, reload, loading, error } = useMenu(),
    { commerce } = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const draft = useFormDraft(
    "delivery",
    {
      revision: menu.revision,
      delivery: menu.commerce?.delivery ?? emptyCommerce().delivery,
    },
    deliveryDraftSchema.parse,
  )
  const { delivery } = draft.value,
    set = (next: typeof delivery) => draft.set((v) => ({ ...v, delivery: next }))
  const [editor, setEditor] = useState<{ zone?: DeliveryZone } | null>(null),
    [deleting, setDeleting] = useState<DeliveryZone | null>(null),
    [search, setSearch] = useState("")
  const readOnly = !!account && !can(account.restaurant.role, "catalog:write"),
    blocked = readOnly || loading || !!error || mutation.pending || !commerce
  async function refresh() {
    const latest = await reload()
    if (latest) draft.set((v) => ({ ...v, revision: latest.revision }))
    mutation.clearError()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (blocked || !commerce) return
    const result = await mutation.run(() =>
      commerce.delivery(menu.restaurant.id, draft.value.revision, delivery),
    )
    if (result?.ok) {
      draft.reset({
        revision: result.value.revision,
        delivery: result.value.commerce!.delivery,
      })
      notifySuccess("Entregas e retirada salvas.")
    }
  }
  const zones = delivery.zones.filter((z) =>
    normalizeName(`${z.city} ${z.neighborhood} ${z.state}`).includes(
      normalizeName(search),
    ),
  )
  return (
    <section>
      <PageHeading
        eyebrow="Do balcão à porta"
        title="Entregas e retirada"
        description="Defina onde sua loja atende e quanto custa chegar até cada cliente."
      />
      <ValidatedForm className="delivery-settings" onSubmit={(e) => void submit(e)}>
        <DraftNotice draft={draft} />
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {draft.value.revision !== menu.revision && (
          <div className="info-notice">
            A loja mudou durante a edição.{" "}
            <button type="button" onClick={() => void refresh()}>
              Atualizar e revisar
            </button>
          </div>
        )}
        <fieldset disabled={blocked}>
          <div className="fulfillment-grid">
            <section className="settings-card">
              <Bike size={26} />
              <h2>Entrega ao cliente</h2>
              <p>Receba pedidos para os bairros cadastrados ou com uma taxa única.</p>
              <ToggleField
                label="Aceitar entregas"
                checked={delivery.enabled}
                onChange={(enabled) => set({ ...delivery, enabled })}
              />
              <SelectField
                label="Como calcular o frete"
                value={delivery.mode}
                onChange={(e) =>
                  set({ ...delivery, mode: e.target.value as "FLAT" | "ZONES" })
                }
              >
                <option value="FLAT">Taxa única da loja</option>
                <option value="ZONES">Por cidade e bairro</option>
              </SelectField>
              {delivery.mode === "FLAT" && (
                <p className="field-help">
                  Taxa atual: {formatMoney(menu.restaurant.deliveryFee)}. Altere em
                  Configurações da loja.
                </p>
              )}
            </section>
            <section className="settings-card">
              <Store size={26} />
              <h2>Retirada na loja</h2>
              <p>O cliente busca no balcão e não paga frete.</p>
              <ToggleField
                label="Aceitar retirada"
                checked={delivery.pickupEnabled}
                onChange={(pickupEnabled) => set({ ...delivery, pickupEnabled })}
              />
              <InputField
                label="Previsão de preparo para retirada"
                required
                maxLength={80}
                value={delivery.pickupEta}
                onChange={(e) => set({ ...delivery, pickupEta: e.target.value })}
              />
            </section>
          </div>
          <section className="delivery-regions">
            <div className="section-heading">
              <div>
                <h2>Regiões atendidas</h2>
                <p>Edite a lista e salve as entregas para publicar.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditor({})}
                disabled={delivery.zones.length >= 500}
              >
                <Plus size={18} /> Adicionar bairro
              </button>
            </div>
            <InputField
              label="Buscar cidade ou bairro"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {zones.length ? (
              <div className="region-list">
                {zones.map((zone) => (
                  <article className="region-card" key={zone.id}>
                    <span className="region-icon">
                      <MapPin size={22} />
                    </span>
                    <div>
                      <h3>{zone.neighborhood}</h3>
                      <p>
                        {zone.city} / {zone.state}
                      </p>
                      <small>
                        {zone.etaMin}–{zone.etaMax} min ·{" "}
                        {zone.active ? "Atendido" : "Pausado"}
                      </small>
                    </div>
                    <strong>{formatMoney(zone.fee)}</strong>
                    <div className="region-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Editar bairro ${zone.neighborhood}`}
                        onClick={() => setEditor({ zone })}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover bairro ${zone.neighborhood}`}
                        onClick={() => setDeleting(zone)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-search">
                <MapPin size={32} />
                <h3>Nenhum bairro nesta lista</h3>
                <p>Cadastre os bairros da sua cidade e das cidades próximas.</p>
              </div>
            )}
          </section>
        </fieldset>
        <FormActions busy={blocked} label="Salvar entregas" />
      </ValidatedForm>
      {editor && (
        <ZoneForm
          zone={editor.zone}
          onClose={() => setEditor(null)}
          onAdd={(zone) => {
            set({
              ...delivery,
              zones: delivery.zones.some((z) => z.id === zone.id)
                ? delivery.zones.map((z) => (z.id === zone.id ? zone : z))
                : [...delivery.zones, zone],
            })
            notifySuccess(
              "Bairro adicionado à lista. Clique em Salvar entregas para publicar.",
            )
          }}
        />
      )}
      {deleting && (
        <Dialog title="Remover bairro da lista" onClose={() => setDeleting(null)}>
          <div className="editor-form">
            <p>
              Remover {deleting.neighborhood}, {deleting.city}? A alteração será publicada
              ao salvar as entregas.
            </p>
            <div className="form-actions">
              <button className="secondary-button" onClick={() => setDeleting(null)}>
                Manter bairro
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  set({
                    ...delivery,
                    zones: delivery.zones.filter((z) => z.id !== deleting.id),
                  })
                  setDeleting(null)
                }}
              >
                Remover da lista
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
