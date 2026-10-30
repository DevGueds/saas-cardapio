import { useState, type FormEvent } from "react"
import { Share2, Save, Copy, Check } from "lucide-react"
import { can } from "@cardapio/domain/permissions"
import { defaultMenuSharing, type MenuSharing } from "@cardapio/domain/menu-sharing"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import PageHeading from "../../../shared/presentation/PageHeading"
import ImagePicker from "../../../shared/presentation/ImagePicker"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"

const networks = ["WhatsApp", "Facebook", "LinkedIn", "X"] as const
export default function SharingPage() {
  const { menu, loading, error: loadError, reload } = useMenu(),
    services = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const [draft, setDraft] = useState<{ data: MenuSharing; revision: number } | null>(
      null,
    ),
    [network, setNetwork] = useState<(typeof networks)[number]>("WhatsApp"),
    [busy, setBusy] = useState({ squareImage: false, landscapeImage: false }),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false)
  const value = draft?.data ?? menu.restaurant.sharing ?? defaultMenuSharing()
  const title = value.title || menu.restaurant.name,
    description =
      value.description ||
      menu.restaurant.description ||
      "Confira nosso cardápio e faça seu pedido."
  const url = new URL(
    `/menu/${encodeURIComponent(menu.restaurant.slug)}`,
    window.location.origin,
  ).href
  const image = value.format === "SQUARE" ? value.squareImage : value.landscapeImage
  const blocked =
    mutation.pending ||
    loading ||
    !!loadError ||
    busy.squareImage ||
    busy.landscapeImage ||
    !services.restaurant.sharing ||
    (!!account && !can(account.restaurant.role, "catalog:write"))
  function edit(key: keyof MenuSharing, text: string) {
    setDraft({
      data: { ...value, [key]: text },
      revision: draft?.revision ?? menu.revision,
    })
    setSaved(false)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (blocked || !services.restaurant.sharing) return
    const result = await mutation.run(() =>
      services.restaurant.sharing!(
        menu.restaurant.id,
        draft?.revision ?? menu.revision,
        value,
      ),
    )
    if (result?.ok) {
      setDraft(null)
      setSaved(true)
    }
  }
  async function refresh() {
    const latest = await reload()
    if (latest) {
      setDraft((old) => old && { ...old, revision: latest.revision })
      mutation.clearError()
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <section className="sharing-page">
      <PageHeading
        eyebrow="Sua loja nas redes"
        title="Compartilhar cardápio"
        description="Escolha a imagem e a mensagem que acompanham o link da sua loja."
      />
      <div className="sharing-link">
        <label className="field">
          <span>Link do seu cardápio</span>
          <ValidatedInput
            value={url}
            readOnly
            onFocus={(event) => event.target.select()}
          />
        </label>
        <button type="button" className="secondary-button" onClick={() => void copy()}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
      </div>
      {copyError && (
        <p role="status" className="field-help">
          Selecione o link acima e copie usando o menu do seu dispositivo.
        </p>
      )}
      <div className="sharing-layout">
        <ValidatedForm className="settings-form" onSubmit={(event) => void submit(event)}>
          <fieldset
            disabled={
              mutation.pending ||
              loading ||
              (!!account && !can(account.restaurant.role, "catalog:write"))
            }
          >
            <InputField
              label="Título do convite"
              maxLength={100}
              value={value.title}
              placeholder={menu.restaurant.name}
              help="Se ficar vazio, usaremos o nome da loja."
              onChange={(event) => edit("title", event.target.value)}
            />
            <label className="field">
              <span>Mensagem do convite</span>
              <ValidatedTextarea
                rows={3}
                maxLength={240}
                value={value.description}
                placeholder={description}
                onChange={(event) => edit("description", event.target.value)}
              />
              <small className="field-help">
                {value.description.length}/240 caracteres. Se ficar vazio, usaremos a
                descrição da loja.
              </small>
            </label>
            <SelectField
              label="Formato preferido da imagem"
              value={value.format}
              onChange={(event) => edit("format", event.target.value)}
            >
              <option value="SQUARE">Quadrado · 600 × 600</option>
              <option value="LANDSCAPE">Paisagem · 1200 × 630</option>
            </SelectField>
            <p className="field-help">
              Sem uma foto enviada, criamos uma imagem com o nome e a mensagem da sua
              loja. Fotos enviadas serão ajustadas ao formato escolhido; mantenha as
              partes importantes no centro.
            </p>
            <details open={value.format === "SQUARE"}>
              <summary>Imagem quadrada · 600 × 600</summary>
              <ImagePicker
                label="Imagem quadrada do convite"
                value={value.squareImage}
                reader={services.images}
                onChange={(text) => edit("squareImage", text)}
                onBusyChange={(next) => setBusy((old) => ({ ...old, squareImage: next }))}
              />
            </details>
            <details open={value.format === "LANDSCAPE"}>
              <summary>Imagem em paisagem · 1200 × 630</summary>
              <ImagePicker
                label="Imagem em paisagem do convite"
                value={value.landscapeImage}
                reader={services.images}
                onChange={(text) => edit("landscapeImage", text)}
                onBusyChange={(next) =>
                  setBusy((old) => ({ ...old, landscapeImage: next }))
                }
              />
            </details>
          </fieldset>
          {mutation.error && (
            <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
          )}
          {saved && (
            <p className="success-notice" role="status">
              Convite salvo. O link já usa as novas informações; as redes podem levar um
              tempo para atualizar a imagem.
            </p>
          )}
          <button className="primary-button" disabled={blocked}>
            <Save size={18} aria-hidden="true" />
            {mutation.pending ? "Salvando…" : "Salvar convite"}
          </button>
        </ValidatedForm>
        <aside className="sharing-preview" aria-label="Prévia do convite">
          <h2>
            <Share2 size={20} aria-hidden="true" /> Veja como pode aparecer
          </h2>
          <div
            className="sharing-networks"
            role="group"
            aria-label="Escolher rede para prévia"
          >
            {networks.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={item === network}
                onClick={() => setNetwork(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div
            className={`social-preview social-preview--${network.toLowerCase()} social-preview--${value.format.toLowerCase()}`}
          >
            {image ? (
              <img src={image} alt="Imagem do convite" />
            ) : (
              <div className="social-preview__generated">
                <span>O próximo pedido começa aqui.</span>
                <strong>{title}</strong>
                <p>{description}</p>
                <small>Confira nosso cardápio →</small>
              </div>
            )}
            <div className="social-preview__text">
              <small>{window.location.hostname}</small>
              <h3>{title}</h3>
              <p>{description}</p>
              <span>{url}</span>
            </div>
          </div>
          <p className="field-help">
          Prévia ilustrativa do link. Cada rede pode cortar imagens e abreviar textos de
          forma diferente.
          </p>
          <p className="field-help">
            O formato quadrado funciona bem em mensagens. Paisagem oferece mais espaço em
            publicações e feeds.
          </p>
        </aside>
      </div>
    </section>
  )
}
