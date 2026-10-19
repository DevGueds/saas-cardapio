import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { moneyField } from "@cardapio/contracts"
import type { AddonGroup } from "@cardapio/domain/menu-options"
import { moneyInput, parseMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { InputField, ToggleField, FormActions } from "../../../shared/presentation/Fields"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import { addonDraftSchema } from "../application/addon-drafts"

export default function AddonForm({
  group,
  onClose,
}: {
  group?: AddonGroup
  onClose(): void
}) {
  const { menu, reload } = useMenu(),
    { commerce } = useServices(),
    mutation = useMutation()
  const draft = useFormDraft(
    `addon:${group?.id ?? "new"}`,
    {
      revision: menu.revision,
      id: group?.id ?? crypto.randomUUID(),
      name: group?.name ?? "",
      active: group?.active ?? true,
      min: String(group?.min ?? 0),
      max: String(group?.max ?? 3),
      productIds: group?.productIds ?? [],
      options: group?.options.map((o) => ({
        ...o,
        price: moneyInput(o.price),
        maxQuantity: String(o.maxQuantity),
      })) ?? [
        {
          id: crypto.randomUUID(),
          name: "",
          price: "0,00",
          available: true,
          maxQuantity: "1",
        },
      ],
    },
    addonDraftSchema.parse,
  )
  const v = draft.value,
    field = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) =>
      draft.set((old) => ({ ...old, [key]: value }))
  const [search, setSearch] = useState("")
  async function refresh() {
    const latest = await reload()
    if (latest) field("revision", latest.revision)
    mutation.clearError()
  }
  return (
    <Dialog
      title={group ? "Editar grupo de adicionais" : "Novo grupo de adicionais"}
      onClose={onClose}
      busy={mutation.pending}
      className="offer-dialog"
    >
      <ValidatedForm
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!commerce) return
          void mutation
            .run(
              async () =>
                commerce.addon(menu.restaurant.id, v.revision, {
                  id: v.id,
                  name: v.name,
                  active: v.active,
                  productIds: v.productIds,
                  min: Number(v.min),
                  max: Number(v.max),
                  options: v.options.map((o) => ({
                    ...o,
                    price: parseMoney(o.price, "price"),
                    maxQuantity: Number(o.maxQuantity),
                  })),
                }),
              "Grupo de adicionais salvo.",
            )
            .then((result) => {
              if (result?.ok) {
                draft.clear()
                onClose()
              }
            })
        }}
      >
        <DraftNotice draft={draft} />
        <p className="form-intro">
          Reutilize o mesmo grupo em vários produtos. Ex.: extras do lanche, molhos ou
          porções adicionais. As quantidades são por unidade do produto.
        </p>
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {v.revision !== menu.revision && (
          <p className="info-notice">
            O cardápio mudou.{" "}
            <button type="button" onClick={() => void refresh()}>
              Atualizar e revisar
            </button>
          </p>
        )}
        <fieldset disabled={mutation.pending}>
          <InputField
            label="Nome do grupo"
            value={v.name}
            required
            maxLength={80}
            onChange={(e) => field("name", e.target.value)}
          />
          <div className="form-row">
            <InputField
              label="Quantidade mínima"
              type="number"
              required
              min={0}
              max={20}
              value={v.min}
              help="Zero torna o grupo opcional."
              onChange={(e) => field("min", e.target.value)}
            />
            <InputField
              label="Quantidade máxima"
              type="number"
              required
              min={1}
              max={20}
              value={v.max}
              onChange={(e) => field("max", e.target.value)}
            />
          </div>
          <section className="offer-section">
            <h3>Opções e preços</h3>
            {v.options.map((o, index) => {
              const change = (next: typeof o) =>
                field(
                  "options",
                  v.options.map((old) => (old.id === o.id ? next : old)),
                )
              return (
                <div className="choice-editor" key={o.id}>
                  <div className="form-row">
                    <InputField
                      label={`Nome da opção ${index + 1}`}
                      required
                      maxLength={80}
                      value={o.name}
                      onChange={(e) => change({ ...o, name: e.target.value })}
                    />
                    <InputField
                      label={`Preço da opção ${index + 1} (R$)`}
                      required
                      inputMode="decimal"
                      schema={moneyField()}
                      validation="money"
                      value={o.price}
                      onChange={(e) => change({ ...o, price: e.target.value })}
                    />
                    <InputField
                      label={`Limite da opção ${index + 1}`}
                      type="number"
                      required
                      min={1}
                      max={20}
                      value={o.maxQuantity}
                      onChange={(e) => change({ ...o, maxQuantity: e.target.value })}
                    />
                  </div>
                  <div className="addon-row">
                    <ToggleField
                      label={`Opção ${index + 1} disponível`}
                      checked={o.available}
                      onChange={(available) => change({ ...o, available })}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remover opção ${index + 1} do rascunho`}
                      onClick={() =>
                        field(
                          "options",
                          v.options.filter((old) => old.id !== o.id),
                        )
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              className="secondary-button"
              disabled={v.options.length >= 30}
              onClick={() =>
                field("options", [
                  ...v.options,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    price: "0,00",
                    available: true,
                    maxQuantity: "1",
                  },
                ])
              }
            >
              <Plus size={18} /> Adicionar opção
            </button>
          </section>
          <section className="offer-section">
            <h3>Oferecer em quais produtos?</h3>
            <p className="field-help">
              {v.productIds.length} selecionados. Sem vínculos, o grupo fica salvo para
              uso futuro.
            </p>
            <InputField
              label="Buscar produto para vincular"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="addon-product-list">
              {menu.products
                .filter((p) =>
                  p.name
                    .toLocaleLowerCase("pt-BR")
                    .includes(search.toLocaleLowerCase("pt-BR")),
                )
                .map((p) => (
                  <ToggleField
                    key={p.id}
                    label={p.name}
                    checked={v.productIds.includes(p.id)}
                    onChange={(checked) =>
                      field(
                        "productIds",
                        checked
                          ? [...v.productIds, p.id]
                          : v.productIds.filter((id) => id !== p.id),
                      )
                    }
                  />
                ))}
            </div>
          </section>
          <ToggleField
            label="Grupo ativo no cardápio"
            checked={v.active}
            onChange={(active) => field("active", active)}
          />
          <p className="field-help">
            Salvar publica as escolhas e preços nos produtos vinculados. Pedidos já
            registrados mantêm o valor original.
          </p>
        </fieldset>
        <FormActions
          busy={mutation.pending || !commerce}
          onCancel={onClose}
          label="Salvar grupo"
        />
      </ValidatedForm>
    </Dialog>
  )
}
