import { useState } from "react"
import { z } from "zod"
import { Link } from "react-router"
import { can } from "@cardapio/domain/permissions"
import { appearanceSchema } from "@cardapio/contracts"
import { defaultAppearance, type MenuAppearance } from "@cardapio/domain/menu-options"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import { useMutation } from "../../../shared/presentation/use-mutation"
import {
  InputField,
  SelectField,
  ToggleField,
  FormActions,
} from "../../../shared/presentation/Fields"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import PageHeading from "../../../shared/presentation/PageHeading"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import QrDesigner from "../../../shared/presentation/QrDesigner"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import PublicProductCard from "../../catalog/presentation/PublicProductCard"
const draftSchema = z.object({
  revision: z.number().int(),
  appearance: appearanceSchema.extend({ headline: z.string().max(120) }),
})
export default function AppearancePage() {
  const { menu, reload, loading, error } = useMenu(),
    { commerce } = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const draft = useFormDraft(
    "appearance",
    {
      revision: menu.revision,
      appearance: menu.commerce?.appearance ?? defaultAppearance(),
    },
    draftSchema.parse,
  )
  const [origin, setOrigin] = useState(window.location.origin),
    a = draft.value.appearance
  const set = (appearance: MenuAppearance) => draft.set((v) => ({ ...v, appearance }))
  let publicUrl = ""
  try {
    const base = new URL(origin)
    if (["https:", "http:"].includes(base.protocol) && !base.username && !base.password)
      publicUrl = new URL(
        `${import.meta.env.BASE_URL}menu/${menu.restaurant.slug}`,
        base.origin,
      ).href
  } catch {
    /* The input remains editable. */
  }
  if (account && !can(account.restaurant.role, "catalog:write"))
    return <p className="info-notice">Seu perfil não permite personalizar o cardápio.</p>
  async function refresh() {
    const latest = await reload()
    if (latest) draft.set((v) => ({ ...v, revision: latest.revision }))
    mutation.clearError()
  }
  return (
    <section className="appearance-page">
      <PageHeading
        eyebrow="A cara da sua loja"
        title="Aparência e QR Code"
        description="Escolha um modelo, ajuste o visual e compartilhe seu cardápio. Os produtos são os que você já cadastrou."
      />
      <ValidatedForm
        className="settings-card"
        onSubmit={(e) => {
          e.preventDefault()
          if (!commerce) return
          void mutation
            .run(
              () => commerce.appearance(menu.restaurant.id, draft.value.revision, a),
              "Aparência publicada.",
            )
            .then((r) => {
              if (r?.ok)
                draft.reset({
                  revision: r.value.revision,
                  appearance: r.value.commerce!.appearance!,
                })
            })
        }}
      >
        <DraftNotice draft={draft} />
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {!loading && !mutation.pending && draft.value.revision !== menu.revision && (
          <p className="info-notice">
            O cardápio mudou.{" "}
            <button type="button" onClick={() => void refresh()}>
              Atualizar e revisar
            </button>
          </p>
        )}
        <fieldset disabled={loading || !!error || mutation.pending || !commerce}>
          <div className="form-row">
            <SelectField
              label="Modelo do cardápio"
              value={a.preset}
              onChange={(e) =>
                set({ ...a, preset: e.target.value as MenuAppearance["preset"] })
              }
            >
              <option value="CLASSIC">Clássico · cartões lado a lado</option>
              <option value="EDITORIAL">Vitrine · fotos em destaque</option>
              <option value="COMPACT">Compacto · lista rápida</option>
            </SelectField>
            <SelectField
              label="Cor de destaque"
              value={a.color}
              onChange={(e) =>
                set({ ...a, color: e.target.value as MenuAppearance["color"] })
              }
            >
              <option value="ORANGE">Terracota</option>
              <option value="GREEN">Verde da casa</option>
              <option value="BLUE">Azul</option>
              <option value="PLUM">Ameixa</option>
            </SelectField>
          </div>
          <InputField
            label="Mensagem de boas-vindas"
            maxLength={120}
            value={a.headline}
            onChange={(e) => set({ ...a, headline: e.target.value })}
          />
          <ToggleField
            label="Exibir fotos dos produtos"
            checked={a.showImages}
            onChange={(showImages) => set({ ...a, showImages })}
          />
        </fieldset>
        <FormActions
          busy={mutation.pending}
          disabled={loading || !!error || !commerce}
          label="Publicar aparência"
        />
      </ValidatedForm>
      <section
        className={`appearance-preview menu-theme menu-theme--${a.preset.toLowerCase()} menu-color--${a.color.toLowerCase()} ${a.showImages ? "" : "menu-without-images"}`}
        aria-label="Prévia com os produtos da loja"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">Prévia do modelo</span>
            <h2>{a.headline || menu.restaurant.name}</h2>
          </div>
          <Link
            className="text-button"
            to={`/menu/${menu.restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir cardápio publicado
          </Link>
        </div>
        <div className="product-grid">
          {menu.products.slice(0, 4).map((p) => (
            <PublicProductCard
              key={p.id}
              product={p}
              quantity={0}
              disabled
              onQuantityChange={() => {}}
            />
          ))}
        </div>
        {!menu.products.length && (
          <p>Cadastre produtos para visualizar este modelo com seu catálogo.</p>
        )}
      </section>
      <section className="settings-card">
        <InputField
          label="Endereço usado pelos clientes"
          type="url"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          help="No Docker local, use o IP deste computador e a porta 8080 para abrir em outros aparelhos da mesma rede. Ex.: http://192.168.1.10:8080."
        />
        {publicUrl ? (
          <FeatureBoundary label="QR Code do cardápio">
            <QrDesigner
              url={publicUrl}
              logo={menu.restaurant.logoUrl}
              title="QR Code do cardápio"
              filename={`cardapio-${menu.restaurant.slug}`}
            />
          </FeatureBoundary>
        ) : (
          <p role="status">
            Informe um endereço HTTP ou HTTPS válido para gerar o QR Code.
          </p>
        )}
      </section>
    </section>
  )
}
