import { moneyField } from "@cardapio/contracts"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"
import { useState, type FormEvent } from "react"
import { Plus, Trash2, PackagePlus } from "lucide-react"
import type { Combo } from "@cardapio/domain/commerce"
import { moneyInput, parseMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import Dialog from "../../../shared/presentation/Dialog"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ImagePicker from "../../../shared/presentation/ImagePicker"
import {
  InputField,
  SelectField,
  ToggleField,
  FormActions,
} from "../../../shared/presentation/Fields"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { comboDraftSchema } from "../application/offer-drafts"
export default function ComboForm({
  combo,
  onClose,
  onSaved,
}: {
  combo?: Combo
  onClose(): void
  onSaved(): void
}) {
  const { menu, reload } = useMenu(),
    services = useServices(),
    mutation = useMutation()
  const draft = useFormDraft(
    `combo:${combo?.id ?? "new"}`,
    {
      revision: menu.revision,
      id: combo?.id ?? services.ids.next(),
      name: combo?.name ?? "",
      description: combo?.description ?? "",
      price: combo ? moneyInput(combo.price) : "",
      active: combo?.active ?? true,
      imageRemoved: false,
      items:
        combo?.items.map((item) => ({ ...item, quantity: String(item.quantity) })) ?? [],
      groups:
        combo?.groups.map((g) => ({
          ...g,
          options: g.options.map((o) => ({ ...o, extraPrice: moneyInput(o.extraPrice) })),
        })) ?? [],
    },
    comboDraftSchema.parse,
  )
  const value = draft.value,
    set = draft.set
  const [image, setImage] = useState<string | null>(null),
    [imageBusy, setImageBusy] = useState(false)
  const field = <K extends keyof typeof value>(key: K, next: (typeof value)[K]) =>
    set((v) => ({ ...v, [key]: next }))
  const busy = mutation.pending || imageBusy
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!services.commerce || busy) return
    const result = await mutation.run(async () =>
      services.commerce!.combo(menu.restaurant.id, value.revision, {
        id: value.id,
        name: value.name,
        description: value.description,
        price: parseMoney(value.price, "price", true),
        active: value.active,
        imageUrl: image ?? (value.imageRemoved ? "" : (combo?.imageUrl ?? "")),
        items: value.items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
        groups: value.groups.map((g) => ({
          ...g,
          options: g.options.map((o) => ({
            ...o,
            extraPrice: parseMoney(o.extraPrice, "extraPrice"),
          })),
        })),
      }),
    )
    if (result?.ok) {
      draft.clear()
      onSaved()
    }
  }
  async function refresh() {
    const latest = await reload()
    if (latest) field("revision", latest.revision)
    mutation.clearError()
  }
  return (
    <Dialog
      title={combo ? "Editar combo" : "Novo combo"}
      onClose={onClose}
      busy={busy}
      className="offer-dialog"
    >
      <ValidatedForm className="editor-form" onSubmit={(e) => void submit(e)}>
        <DraftNotice draft={draft} />
        <p className="form-intro">
          Monte uma combinação pronta ou deixe o cliente escolher. O preço do combo
          substitui o preço dos produtos incluídos.
        </p>
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {value.revision !== menu.revision && (
          <div className="info-notice">
            O cardápio mudou.{" "}
            <button type="button" onClick={() => void refresh()}>
              Atualizar e revisar
            </button>
          </div>
        )}
        <fieldset disabled={busy}>
          <div className="form-row">
            <InputField
              label="Nome do combo"
              required
              maxLength={120}
              placeholder="Ex.: Dupla da casa"
              validation="name"
              value={value.name}
              onChange={(e) => field("name", e.target.value)}
            />
            <InputField
              label="Preço do combo (R$)"
              required
              inputMode="decimal"
              maxLength={20}
              placeholder="49,90"
              validation="money"
              schema={moneyField(true)}
              value={value.price}
              onChange={(e) => field("price", e.target.value)}
            />
          </div>
          <label className="field">
            <span>Descrição</span>
            <ValidatedTextarea
              rows={3}
              maxLength={2000}
              value={value.description}
              placeholder="Conte o que vem e para quantas pessoas é ideal."
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <ImagePicker
            label="Foto do combo"
            value={image ?? (value.imageRemoved ? "" : (combo?.imageUrl ?? ""))}
            onChange={(next) => {
              setImage(next)
              field("imageRemoved", next === "")
            }}
            reader={services.images}
            onBusyChange={setImageBusy}
          />
          <small className="field-help">
            Fotos novas precisam ser selecionadas novamente após recarregar.
          </small>
          <section className="offer-section">
            <h3>
              <PackagePlus size={20} /> Produtos que sempre vêm
            </h3>
            <p className="field-help">Itens fixos, sem escolha do cliente.</p>
            {value.items.map((item, index) => (
              <div className="component-row" key={index}>
                <SelectField
                  label={`Produto fixo ${index + 1}`}
                  value={item.productId}
                  required
                  onChange={(e) =>
                    field(
                      "items",
                      value.items.map((i, n) =>
                        n === index ? { ...i, productId: e.target.value } : i,
                      ),
                    )
                  }
                >
                  <option value="">Selecione</option>
                  {menu.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
                <InputField
                  label="Quantidade"
                  type="number"
                  min={1}
                  max={20}
                  value={item.quantity}
                  onChange={(e) =>
                    field(
                      "items",
                      value.items.map((i, n) =>
                        n === index
                          ? {
                              ...i,
                              quantity: e.target.value,
                            }
                          : i,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Remover produto fixo ${index + 1}`}
                  onClick={() =>
                    field(
                      "items",
                      value.items.filter((_, n) => n !== index),
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              disabled={value.items.length >= 20}
              onClick={() =>
                field("items", [...value.items, { productId: "", quantity: "1" }])
              }
            >
              <Plus size={17} /> Incluir produto fixo
            </button>
          </section>
          <section className="offer-section">
            <h3>Escolhas do cliente</h3>
            <p className="field-help">
              Uma escolha obrigatória por grupo. Ex.: escolha sua bebida. O adicional é
              somado ao preço do combo.
            </p>
            {value.groups.map((group, index) => {
              const change = (next: typeof group) =>
                field(
                  "groups",
                  value.groups.map((g, n) => (n === index ? next : g)),
                )
              return (
                <div className="choice-editor" key={group.id}>
                  <div className="component-row">
                    <InputField
                      label={`Nome da escolha ${index + 1}`}
                      required
                      maxLength={80}
                      validation="name"
                      value={group.name}
                      placeholder="Escolha sua bebida"
                      onChange={(e) => change({ ...group, name: e.target.value })}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remover escolha ${index + 1}`}
                      onClick={() =>
                        field(
                          "groups",
                          value.groups.filter((g) => g.id !== group.id),
                        )
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {group.options.map((option, n) => (
                    <div className="component-row" key={n}>
                      <SelectField
                        label={`Opção ${n + 1}`}
                        required
                        value={option.productId}
                        onChange={(e) =>
                          change({
                            ...group,
                            options: group.options.map((o, j) =>
                              j === n ? { ...o, productId: e.target.value } : o,
                            ),
                          })
                        }
                      >
                        <option value="">Selecione</option>
                        {menu.products.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </SelectField>
                      <InputField
                        label="Adicional (R$)"
                        required
                        inputMode="decimal"
                        maxLength={20}
                        validation="money"
                        value={option.extraPrice}
                        onChange={(e) =>
                          change({
                            ...group,
                            options: group.options.map((o, j) =>
                              j === n ? { ...o, extraPrice: e.target.value } : o,
                            ),
                          })
                        }
                      />
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remover opção ${n + 1}`}
                        onClick={() =>
                          change({
                            ...group,
                            options: group.options.filter((_, j) => j !== n),
                          })
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="text-button"
                    type="button"
                    disabled={group.options.length >= 20}
                    onClick={() =>
                      change({
                        ...group,
                        options: [
                          ...group.options,
                          { productId: "", extraPrice: "0,00" },
                        ],
                      })
                    }
                  >
                    + Adicionar opção
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="secondary-button"
              disabled={value.groups.length >= 8}
              onClick={() =>
                field("groups", [
                  ...value.groups,
                  {
                    id: services.ids.next(),
                    name: "",
                    options: [{ productId: "", extraPrice: "0,00" }],
                  },
                ])
              }
            >
              <Plus size={17} /> Criar grupo de escolhas
            </button>
          </section>
          <ToggleField
            label="Combo ativo no cardápio"
            checked={value.active}
            onChange={(v) => field("active", v)}
          />
          <p className="field-help">
            Se faltar um item fixo ou todas as opções de uma escolha, o combo ficará
            indisponível automaticamente.
          </p>
        </fieldset>
        <FormActions busy={busy} onCancel={onClose} label="Salvar combo" />
      </ValidatedForm>
    </Dialog>
  )
}
