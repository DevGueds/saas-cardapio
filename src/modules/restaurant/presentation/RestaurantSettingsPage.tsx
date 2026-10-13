import { useState, type FormEvent } from "react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { useServices } from "../../../app/presentation/ServicesProvider"

import { moneyInput } from "../../../shared/domain/money"

import ErrorNotice from "../../../shared/presentation/ErrorNotice"

import ImagePicker from "../../../shared/presentation/ImagePicker"

import { useMutation } from "../../../shared/presentation/use-mutation"

import type { RestaurantSettingsInput } from "../application/restaurant-commands"

export default function RestaurantSettingsPage() {
  const { menu, error: loadError, loading, reload } = useMenu()

  const services = useServices()

  const mutation = useMutation()

  const [revision, setRevision] = useState(menu.revision)

  const [saved, setSaved] = useState(false)

  const [imageBusy, setImageBusy] = useState({
    logoUrl: false,
    coverUrl: false,
  })

  const [form, setForm] = useState<RestaurantSettingsInput>(() => ({
    ...menu.restaurant,

    deliveryFee: moneyInput(menu.restaurant.deliveryFee),
    minOrder: moneyInput(menu.restaurant.minOrder),
  }))

  const blocked =
    mutation.pending || loading || !!loadError || imageBusy.logoUrl || imageBusy.coverUrl

  function update(key: keyof RestaurantSettingsInput, value: string) {
    setSaved(false)
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (blocked) return
    setSaved(false)

    const result = await mutation.run(() =>
      services.restaurant.update(menu.restaurant.id, revision, form),
    )

    if (result?.ok) {
      setRevision(result.value.revision)
      setSaved(true)
    }
  }

  async function refresh() {
    const latest = await reload()
    if (latest) {
      setRevision(latest.revision)
      mutation.clearError()
    }
  }

  const fields: {
    key: keyof RestaurantSettingsInput
    label: string
    required?: boolean
    max: number
  }[] = [
    { key: "name", label: "Nome da loja", required: true, max: 120 },

    { key: "whatsapp", label: "WhatsApp da loja com DDD", max: 30 },

    { key: "address", label: "Endereço da loja", max: 500 },

    { key: "eta", label: "Prazo de entrega", required: true, max: 80 },

    { key: "deliveryFee", label: "Taxa de entrega", required: true, max: 20 },

    { key: "minOrder", label: "Pedido mínimo", required: true, max: 20 },
  ]

  return (
    <section className="settings-page">
      <header>
        <h1>Configurações da loja</h1>
        <p>Atualize as informações exibidas no seu cardápio.</p>
      </header>
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <p className="info-notice">
          Salvar um WhatsApp válido habilita a preparação de pedidos. Deixe o campo vazio
          para desabilitar esse recurso.
        </p>
        {saved && (
          <p role="status" className="success-notice">
            Configurações salvas.
          </p>
        )}
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {revision !== menu.revision && (
          <p className="info-notice">
            Os dados mudaram em outra operação. Atualize a revisão e confira seus campos
            antes de salvar.
          </p>
        )}
        <fieldset disabled={mutation.pending || !!loadError}>
          <div className="form-row">
            {fields.map((field) => (
              <label className="field" key={field.key}>
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <input
                  value={form[field.key]}
                  required={field.required}
                  maxLength={field.max}
                  inputMode={
                    field.key === "deliveryFee" || field.key === "minOrder"
                      ? "decimal"
                      : field.key === "whatsapp"
                        ? "tel"
                        : "text"
                  }
                  onChange={(event) => update(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="field">
            <span>Descrição da loja</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
          <div className="form-row">
            {(["logoUrl", "coverUrl"] as const).map((key) => (
              <ImagePicker
                key={key}
                label={key === "logoUrl" ? "Logo da loja" : "Capa da loja"}
                value={form[key]}
                onChange={(value) => update(key, value)}
                reader={services.images}
                onBusyChange={(busy) =>
                  setImageBusy((current) => ({ ...current, [key]: busy }))
                }
              />
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="primary-button" disabled={blocked}>
            {mutation.pending ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </section>
  )
}
