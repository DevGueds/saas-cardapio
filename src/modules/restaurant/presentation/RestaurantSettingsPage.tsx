import { formatField } from "../../../shared/presentation/form-validation/field-formatters"
import { notifySuccess } from "../../../shared/presentation/notify"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"
import { can } from "@cardapio/domain/permissions"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import { settingsDraftSchema } from "../application/settings-draft"
import { useAccount } from "../../identity/presentation/AccountContext"
import { CheckCircle2, MessageCircle, Save, Store } from "lucide-react"
import { Link } from "react-router"
import PageHeading from "../../../shared/presentation/PageHeading"
import FormSection from "../../../shared/presentation/FormSection"
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
  const account = useAccount()
  const readOnly = !!account && !can(account.restaurant.role, "catalog:write")

  const mutation = useMutation()

  const draft = useFormDraft(
    "settings",
    {
      revision: menu.revision,
      name: menu.restaurant.name,
      description: menu.restaurant.description,
      whatsapp: formatField(menu.restaurant.whatsapp, "phone"),
      address: menu.restaurant.address,
      deliveryFee: moneyInput(menu.restaurant.deliveryFee),
      minOrder: moneyInput(menu.restaurant.minOrder),
      eta: menu.restaurant.eta,
      logoRemoved: false,
      coverRemoved: false,
    },
    settingsDraftSchema.parse,
  )
  const revision = draft.value.revision
  const setRevision = (revision: number) =>
    draft.set((current) => ({ ...current, revision }))
  const [images, setImages] = useState<{ logoUrl?: string; coverUrl?: string }>({})

  const [saved, setSaved] = useState(false)

  const [imageBusy, setImageBusy] = useState({
    logoUrl: false,
    coverUrl: false,
  })

  const form: RestaurantSettingsInput = {
    ...draft.value,
    logoUrl: images.logoUrl ?? (draft.value.logoRemoved ? "" : menu.restaurant.logoUrl),
    coverUrl:
      images.coverUrl ?? (draft.value.coverRemoved ? "" : menu.restaurant.coverUrl),
  }

  const blocked =
    mutation.pending ||
    loading ||
    !!loadError ||
    imageBusy.logoUrl ||
    imageBusy.coverUrl ||
    readOnly

  function update(key: keyof RestaurantSettingsInput, value: string) {
    setSaved(false)
    if (key === "logoUrl" || key === "coverUrl") {
      setImages((current) => ({ ...current, [key]: value }))
      draft.set((current) => ({
        ...current,
        [key === "logoUrl" ? "logoRemoved" : "coverRemoved"]: value === "",
      }))
    } else draft.set((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (blocked) return
    setSaved(false)

    const result = await mutation.run(() =>
      services.restaurant.update(menu.restaurant.id, revision, form),
    )

    if (result?.ok) {
      draft.reset({ ...draft.value, revision: result.value.revision })
      setSaved(true)
      notifySuccess("Configurações salvas.")
    }
  }

  async function refresh() {
    const latest = await reload()
    if (latest) {
      setRevision(latest.revision)
      mutation.clearError()
    }
  }

  const field = (
    key: keyof RestaurantSettingsInput,
    label: string,
    max: number,
    required = false,
    placeholder = "",
    help = "",
  ) => (
    <label className="field" key={key}>
      <span id={`label-${key}`}>
        {label}
        {required ? " *" : ""}
      </span>
      <ValidatedInput
        name={`store-${key}`}
        autoComplete={
          key === "name"
            ? "section-store organization"
            : key === "whatsapp"
              ? "section-store tel"
              : "off"
        }
        aria-labelledby={`label-${key}`}
        validation={
          key === "whatsapp"
            ? "phone"
            : key === "deliveryFee" || key === "minOrder"
              ? "money"
              : key === "name"
                ? "name"
                : undefined
        }
        value={form[key]}
        required={required}
        maxLength={max}
        placeholder={placeholder}
        type={key === "whatsapp" ? "tel" : "text"}
        inputMode={
          key === "deliveryFee" || key === "minOrder"
            ? "decimal"
            : key === "whatsapp"
              ? "tel"
              : "text"
        }
        aria-describedby={help ? `help-${key}` : undefined}
        onChange={(event) => update(key, event.target.value)}
      />
      {help && (
        <small className="field-help" id={`help-${key}`}>
          {help}
        </small>
      )}
    </label>
  )

  return (
    <section className="settings-page">
      <PageHeading
        eyebrow="Do seu jeito"
        title="Configurações da loja"
        description="As informações que ajudam seus clientes a conhecer e pedir na sua loja."
      />
      <div className="settings-layout">
        <ValidatedForm className="settings-form" onSubmit={(event) => void submit(event)}>
          <DraftNotice draft={draft} />
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
          )}
          {revision !== menu.revision && (
            <p className="info-notice">
              Os dados mudaram em outra operação. Atualize a revisão e confira seus campos
              antes de salvar.
            </p>
          )}
          <div className="settings-save">
            <span>
              {saved ? "Tudo salvo por aqui." : "As alterações aparecem após salvar."}
            </span>
            <button className="primary-button" disabled={blocked}>
              <Save size={18} aria-hidden="true" />
              {mutation.pending ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
          <fieldset disabled={mutation.pending || !!loadError || readOnly}>
            <FormSection
              number="01"
              title="Sobre a sua loja"
              description="Apresente seu restaurante para quem vai pedir."
            >
              {field(
                "name",
                "Nome da loja",
                120,
                true,
                "Como seus clientes conhecem a loja",
              )}
              <label className="field">
                <span>Descrição da loja</span>
                <ValidatedTextarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Conte um pouco sobre sua especialidade."
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </label>
              {field(
                "address",
                "Endereço da loja",
                500,
                false,
                "Rua, número, bairro e cidade",
              )}
            </FormSection>
            <FormSection
              number="02"
              title="Recebimento de pedidos"
              description="Escolha o WhatsApp onde deseja conversar com seus clientes."
            >
              {field(
                "whatsapp",
                "WhatsApp da loja com DDD",
                30,
                false,
                "(11) 99999-9999",
                "Salvar um número válido habilita os pedidos pelo WhatsApp. Deixe vazio para desabilitar.",
              )}
              <p className="form-callout">
                <MessageCircle size={19} aria-hidden="true" />
                <span>
                  {services.mode === "api"
                    ? "Os pedidos enviados pelo cardápio chegam ao painel. O WhatsApp é um canal opcional de conversa."
                    : "O cliente revisa o pedido aqui e confirma o envio no WhatsApp."}
                </span>
              </p>
            </FormSection>
            <FormSection
              number="03"
              title="Entrega e valores"
              description="Mostre o prazo e os custos antes de o cliente fazer o pedido."
            >
              {field("eta", "Prazo de entrega", 80, true, "Ex.: 30–45 minutos")}
              <div className="form-row">
                {field(
                  "deliveryFee",
                  "Taxa de entrega",
                  20,
                  true,
                  "0,00",
                  "Valor em reais. Use 0 para entrega grátis.",
                )}
                {field(
                  "minOrder",
                  "Pedido mínimo",
                  20,
                  true,
                  "0,00",
                  "Valor dos produtos, sem a taxa de entrega.",
                )}
              </div>
            </FormSection>
            <FormSection
              number="04"
              title="Identidade da loja"
              description="Dê um toque seu ao cardápio com logo e foto de capa."
            >
              <div className="form-row">
                {(["logoUrl", "coverUrl"] as const).map((key) => (
                  <ImagePicker
                    key={key}
                    label={key === "logoUrl" ? "Logo da loja" : "Capa da loja"}
                    aria-labelledby={`label-${key}`}
                    value={form[key]}
                    onChange={(value) => update(key, value)}
                    reader={services.images}
                    onBusyChange={(busy) =>
                      setImageBusy((current) => ({ ...current, [key]: busy }))
                    }
                  />
                ))}
              </div>
            </FormSection>
          </fieldset>
        </ValidatedForm>
        <aside className="settings-guide" aria-label="Orientações de configuração">
          <span className="guide-icon">
            <Store size={25} aria-hidden="true" />
          </span>
          <h2>Uma loja pronta para receber</h2>
          <p>Informações claras deixam seus clientes mais seguros na hora de pedir.</p>
          <ul>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" />
              Nome e descrição que representam sua loja
            </li>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" />
              WhatsApp para receber as mensagens
            </li>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" />
              Taxa e prazo de entrega bem definidos
            </li>
          </ul>
          <Link
            className="secondary-button"
            to={`/menu/${menu.restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Conferir meu cardápio<span className="sr-only"> (abre em nova aba)</span>
          </Link>
          <small>
            {services.mode === "api"
              ? "As alterações são salvas na sua conta e aparecem no cardápio após a confirmação."
              : "Demonstração: os dados ficam neste navegador."}
          </small>
        </aside>
      </div>
    </section>
  )
}
