import { useState, type FormEvent } from "react"

import { useMenu } from "../../../app/presentation/MenuScope"

import { useServices } from "../../../app/presentation/ServicesProvider"

import { moneyInput } from "../../../shared/domain/money"

import Dialog from "../../../shared/presentation/Dialog"

import ErrorNotice from "../../../shared/presentation/ErrorNotice"

import ImagePicker from "../../../shared/presentation/ImagePicker"

import { useMutation } from "../../../shared/presentation/use-mutation"

import type { Product } from "../domain/catalog"

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

  const [revision, setRevision] = useState(menu.revision)

  const [name, setName] = useState(product?.name ?? "")

  const [description, setDescription] = useState(product?.description ?? "")

  const [price, setPrice] = useState(product ? moneyInput(product.price) : "")

  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? menu.categories[0]?.id ?? "",
  )

  const [newCategory, setNewCategory] = useState(false)

  const [categoryName, setCategoryName] = useState("")

  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "")

  const [imageBusy, setImageBusy] = useState(false)

  const [available, setAvailable] = useState(product?.available ?? true)

  const [popular, setPopular] = useState(product?.popular ?? false)

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
      }),
    )

    if (result?.ok) onSaved()
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
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
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
        <fieldset disabled={mutation.pending || !!loadError}>
          <ImagePicker
            label="Foto do produto"
            value={imageUrl}
            onChange={setImageUrl}
            reader={services.images}
            onBusyChange={setImageBusy}
          />
          <label className="field">
            <span>Nome do produto *</span>
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Categoria *</span>
              <select
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
              </select>
            </label>
            <label className="field">
              <span>Preço de venda *</span>
              <input
                required
                inputMode="decimal"
                placeholder="28,90"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
          </div>
          {newCategory && (
            <label className="field">
              <span>Nome da nova categoria *</span>
              <input
                required
                maxLength={80}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Descrição</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />{" "}
            Disponível no cardápio
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={popular}
              onChange={(event) => setPopular(event.target.checked)}
            />{" "}
            Destacar em Mais vendidos
          </label>
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
      </form>
    </Dialog>
  )
}
