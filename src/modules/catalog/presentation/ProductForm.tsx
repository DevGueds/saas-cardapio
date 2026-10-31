import { moneyField } from "@cardapio/contracts"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"
import ValidatedSelect from "../../../shared/presentation/form-validation/ValidatedSelect"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import { productDraftSchema } from "../application/product-draft"
import { useCallback, useState, type FormEvent } from "react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { useServices } from "../../../app/presentation/ServicesProvider"

import { moneyInput } from "../../../shared/domain/money"

import Dialog from "../../../shared/presentation/Dialog"

import ErrorNotice from "../../../shared/presentation/ErrorNotice"

import ImagePicker from "../../../shared/presentation/ImagePicker"

import { useMutation } from "../../../shared/presentation/use-mutation"

import type { Product } from "../domain/catalog"
import { ToggleField } from "../../../shared/presentation/Fields"
const priceSchema = moneyField(true)

export default function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product?: Product
  onClose(): void
  onSaved(): void
}) {
  const { menu, error: loadError, loading, reload } = useMenu()

  const services = useServices()

  const mutation = useMutation()

  const draft = useFormDraft(
    `product:${product?.id ?? "new"}`,
    {
      revision: menu.revision,
      name: product?.name ?? "",
      description: product?.description ?? "",
      price: product ? moneyInput(product.price) : "",
      categoryId: product?.categoryId ?? menu.categories[0]?.id ?? "",
      newCategory: false,
      categoryName: "",
      available: product?.available ?? true,
      popular: product?.popular ?? false,
      imageRemoved: false,
      addonGroupIds:
        menu.commerce?.addonGroups
          ?.filter((group) => product && group.productIds.includes(product.id))
          .map((group) => group.id) ?? [],
    },
    productDraftSchema.parse,
  )
  const {
    revision,
    name,
    description,
    price,
    categoryId,
    newCategory,
    categoryName,
    available,
    popular,
  } = draft.value
  const field =
    <K extends keyof typeof draft.value>(key: K) =>
    (value: (typeof draft.value)[K]) =>
      draft.set((current) => ({ ...current, [key]: value }))
  const setRevision = field("revision"),
    setName = field("name"),
    setDescription = field("description"),
    setPrice = field("price"),
    setCategoryId = field("categoryId"),
    setNewCategory = field("newCategory"),
    setCategoryName = field("categoryName"),
    setAvailable = field("available"),
    setPopular = field("popular")
  const [pickedImage, setPickedImage] = useState<string | null>(null)
  const imageUrl =
    pickedImage ?? (draft.value.imageRemoved ? "" : (product?.imageUrl ?? ""))
  const setDraft = draft.set
  const setImageUrl = useCallback(
    (value: string) => {
      setPickedImage(value)
      setDraft((current) => ({ ...current, imageRemoved: value === "" }))
    },
    [setDraft],
  )
  const [imageBusy, setImageBusy] = useState(false)

  const blocked = mutation.pending || imageBusy || loading || !!loadError

  async function submit(event: FormEvent) {
    event.preventDefault()

    if (blocked) return

    const result = await mutation.run(() =>
      services.catalog.save({
        restaurantId: menu.restaurant.id,
        expectedRevision: revision,

        id: product?.id,
        name,
        description,
        price,
        categoryId,
        newCategoryName: newCategory ? categoryName : undefined,

        imageUrl,
        available,
        popular,
        addonGroupIds:
          draft.value.addonGroupIds ??
          menu.commerce?.addonGroups
            ?.filter((group) => product && group.productIds.includes(product.id))
            .map((group) => group.id) ??
          [],
      }),
    )

    if (result?.ok) {
      draft.clear()
      onSaved()
    }
  }

  async function refresh() {
    const latest = await reload()

    if (latest) {
      setRevision(latest.revision)
      mutation.clearError()
    }
  }

  return (
    <Dialog
      title={product ? "Editar produto" : "Novo produto"}
      onClose={onClose}
      busy={mutation.pending || imageBusy}
    >
      <ValidatedForm className="editor-form" onSubmit={(event) => void submit(event)}>
        <DraftNotice draft={draft} />
        {loadError && <ErrorNotice error={loadError} onRetry={() => void refresh()} />}
        {mutation.error && (
          <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
        )}
        {revision !== menu.revision && (
          <p className="info-notice">
            O catálogo mudou desde a abertura. Atualize os dados e revise seus campos
            antes de salvar.
          </p>
        )}
        <p className="form-intro">
          Preencha os dados do produto. Os campos com * são obrigatórios.
        </p>
        <fieldset disabled={mutation.pending || !!loadError}>
          <label className="field">
            <span>Nome do produto *</span>
            <ValidatedInput
              required
              placeholder="Ex.: Smash Clássico"
              maxLength={120}
              validation="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Categoria *</span>
              <ValidatedSelect
                value={newCategory ? "__new__" : categoryId}
                onChange={(event) => {
                  setNewCategory(event.target.value === "__new__")
                  if (event.target.value !== "__new__") setCategoryId(event.target.value)
                }}
              >
                <option value="" disabled>
                  Selecione uma categoria
                </option>
                {menu.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__new__">+ Nova categoria</option>
              </ValidatedSelect>
            </label>
            <label className="field">
              <span>Preço de venda *</span>
              <ValidatedInput
                required
                inputMode="decimal"
                placeholder="28,90"
                validation="money"
                schema={priceSchema}
                maxLength={20}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
          </div>
          {newCategory && (
            <label className="field">
              <span>Nome da nova categoria *</span>
              <ValidatedInput
                required
                maxLength={80}
                validation="name"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Descrição</span>
            <ValidatedTextarea
              placeholder="Ingredientes, tamanho e o que torna este produto especial."
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <ImagePicker
            label="Foto do produto"
            value={imageUrl}
            onChange={setImageUrl}
            reader={services.images}
            onBusyChange={setImageBusy}
          />
          <p className="field-help">
            Textos e opções são preservados. Fotos novas precisam ser selecionadas
            novamente após recarregar.
          </p>
          <details className="product-addon-links">
            <summary>Adicionais deste produto</summary>
            <p className="field-help">
              Marque apenas os grupos que o cliente poderá escolher neste produto.
              Desmarcar aqui não altera os outros produtos.
            </p>
            {menu.commerce?.addonGroups?.length ? (
              menu.commerce.addonGroups.map((group) => {
                const selected =
                  draft.value.addonGroupIds ??
                  menu.commerce?.addonGroups
                    ?.filter((entry) => product && entry.productIds.includes(product.id))
                    .map((entry) => entry.id) ??
                  []
                return (
                  <ToggleField
                    key={group.id}
                    label={`${group.name}${group.active ? "" : " (pausado)"}`}
                    checked={selected.includes(group.id)}
                    onChange={(checked) =>
                      field("addonGroupIds")(
                        checked
                          ? [...selected, group.id]
                          : selected.filter((id) => id !== group.id),
                      )
                    }
                  />
                )
              })
            ) : (
              <p className="field-help">
                Crie grupos em “Adicionais e extras” e depois vincule os que combinam com
                este produto.
              </p>
            )}
          </details>
          <div className="product-options">
            <h3>Como aparece no cardápio</h3>
            <label className="check-field">
              <ValidatedInput
                type="checkbox"
                checked={available}
                onChange={(event) => setAvailable(event.target.checked)}
              />{" "}
              Disponível no cardápio
            </label>
            <label className="check-field">
              <ValidatedInput
                type="checkbox"
                checked={popular}
                onChange={(event) => setPopular(event.target.checked)}
              />{" "}
              Destacar no cardápio
            </label>
          </div>
        </fieldset>
        <div className="form-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={mutation.pending || imageBusy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={blocked}>
            {mutation.pending ? "Salvando…" : "Salvar produto"}
          </button>
        </div>
      </ValidatedForm>
    </Dialog>
  )
}
