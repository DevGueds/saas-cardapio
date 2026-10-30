import { useState, type FormEvent } from "react"
import { Plus, Pencil, Trash2, Tags } from "lucide-react"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { notifySuccess } from "../../../shared/presentation/notify"

export default function CategoryManager({ disabled }: { disabled: boolean }) {
  const { menu, reload } = useMenu(),
    { catalog } = useServices(),
    mutation = useMutation()
  const [editor, setEditor] = useState<{
    id?: string
    name: string
    revision: number
  } | null>(null)
  const [removing, setRemoving] = useState<{
    id: string
    name: string
    revision: number
  } | null>(null)
  if (!catalog.saveCategory || !catalog.deleteCategory) return null
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editor || disabled || !catalog.saveCategory) return
    const result = await mutation.run(() =>
      catalog.saveCategory!(menu.restaurant.id, editor.revision, editor.name, editor.id),
    )
    if (result?.ok) {
      setEditor(null)
      notifySuccess("Categoria salva.")
    }
  }
  async function remove() {
    if (!removing || disabled || !catalog.deleteCategory) return
    const result = await mutation.run(() =>
      catalog.deleteCategory!(menu.restaurant.id, removing.revision, removing.id),
    )
    if (result?.ok) {
      setRemoving(null)
      notifySuccess("Categoria excluída.")
    }
  }
  async function refresh() {
    const latest = await reload()
    if (latest) {
      setEditor((value) => value && { ...value, revision: latest.revision })
      setRemoving((value) => value && { ...value, revision: latest.revision })
      mutation.clearError()
    }
  }
  return (
    <section className="category-manager" aria-label="Gestão de categorias">
      <details>
        <summary>
          <Tags size={20} aria-hidden="true" /> Categorias do cardápio{" "}
          <span>({menu.categories.length}) · Gerenciar</span>
        </summary>
        <div className="category-manager__body">
          <p className="field-help">
            Organize seus produtos. Para excluir uma categoria, mova primeiro seus
            produtos para outra.
          </p>
          <button
            className="secondary-button"
            disabled={disabled}
            onClick={() => {
              mutation.clearError()
              setEditor({ name: "", revision: menu.revision })
            }}
          >
            <Plus size={18} aria-hidden="true" /> Nova categoria
          </button>
          {menu.categories.length === 0 && (
            <p>Nenhuma categoria criada. Comece pela primeira.</p>
          )}
          <ul>
            {menu.categories.map((category) => {
              const count = menu.products.filter(
                (p) => p.categoryId === category.id,
              ).length
              return (
                <li key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <small>
                      {count} {count === 1 ? "produto" : "produtos"}
                    </small>
                  </div>
                  <div>
                    <button
                      className="text-button"
                      disabled={disabled}
                      aria-label={`Editar categoria ${category.name}`}
                      onClick={() => {
                        mutation.clearError()
                        setEditor({ ...category, revision: menu.revision })
                      }}
                    >
                      <Pencil size={17} aria-hidden="true" /> Editar
                    </button>
                    <button
                      className="text-button"
                      disabled={disabled || count > 0}
                      aria-label={`Excluir categoria ${category.name}`}
                      title={count ? "Mova os produtos antes de excluir" : undefined}
                      onClick={() => {
                        mutation.clearError()
                        setRemoving({ ...category, revision: menu.revision })
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" /> Excluir
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </details>
      {editor && (
        <Dialog
          title={editor.id ? "Editar categoria" : "Nova categoria"}
          busy={mutation.pending}
          onClose={() => setEditor(null)}
        >
          <ValidatedForm className="editor-form" onSubmit={(event) => void save(event)}>
            <label className="field">
              <span>Nome da categoria *</span>
              <ValidatedInput
                autoFocus
                name="categoryName"
                required
                maxLength={80}
                value={editor.name}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                disabled={mutation.pending}
              />
            </label>
            {mutation.error && (
              <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={disabled || mutation.pending}>
                {mutation.pending ? "Salvando…" : "Salvar categoria"}
              </button>
            </div>
          </ValidatedForm>
        </Dialog>
      )}
      {removing && (
        <Dialog
          title="Excluir categoria"
          busy={mutation.pending}
          onClose={() => setRemoving(null)}
        >
          <div className="editor-form">
            <p>Excluir a categoria “{removing.name}”?</p>
            <p>Os produtos e pedidos das outras categorias serão preservados.</p>
            {mutation.error && (
              <ErrorNotice error={mutation.error} onRetry={() => void refresh()} />
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                disabled={disabled || mutation.pending}
                onClick={() => void remove()}
              >
                {mutation.pending ? "Excluindo…" : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
