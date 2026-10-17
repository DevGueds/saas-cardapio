import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { type FormEvent } from "react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import StoreFields from "./StoreFields"
export default function CreateStoreDialog({
  onClose,
  onCreated,
}: {
  onClose(): void
  onCreated(id: string): void
}) {
  const { auth } = useServices(),
    mutation = useMutation()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) return
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get("restaurantName") ?? "")
    const result = await mutation.run(() =>
      auth.createTenant({
        name,
        restaurantName: name,
        slug: String(fields.get("slug") ?? ""),
      }),
    )
    if (result?.ok) onCreated(result.value.restaurantId)
  }
  return (
    <Dialog title="Criar nova loja" onClose={onClose} busy={mutation.pending}>
      <ValidatedForm className="editor-form" onSubmit={(event) => void submit(event)}>
        <p className="form-intro">
          A nova loja terá cardápio e pedidos próprios. Ela começa fechada para você
          configurar com tranquilidade.
        </p>
        <fieldset disabled={mutation.pending}>
          <StoreFields />
        </fieldset>
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={mutation.pending}
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={mutation.pending}>
            {mutation.pending ? "Criando…" : "Criar loja"}
          </button>
        </div>
      </ValidatedForm>
    </Dialog>
  )
}
