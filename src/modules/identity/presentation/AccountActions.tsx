import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
export default function AccountActions() {
  const { auth } = useServices(),
    navigate = useNavigate(),
    mutation = useMutation()
  const [changing, setChanging] = useState(false)
  async function logout() {
    if (!auth) return
    const result = await mutation.run(() => auth.logout())
    if (result?.ok) navigate("/login", { replace: true })
  }
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) return
    const data = new FormData(event.currentTarget)
    const result = await mutation.run(() =>
      auth.changePassword({
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
      }),
    )
    if (result?.ok) navigate("/login", { replace: true })
  }
  return (
    <>
      <div className="account-actions">
        <Link to="/admin">Trocar de loja</Link>
        <button onClick={() => setChanging(true)}>Alterar senha</button>
        <button disabled={mutation.pending} onClick={() => void logout()}>
          Sair da conta
        </button>
      </div>
      {mutation.error && !changing && <ErrorNotice error={mutation.error} />}
      {changing && (
        <Dialog
          title="Alterar sua senha"
          onClose={() => setChanging(false)}
          busy={mutation.pending}
        >
          <form className="editor-form" onSubmit={(event) => void change(event)}>
            <p className="form-intro">
              Após salvar, você precisará entrar novamente em todos os dispositivos.
            </p>
            <fieldset disabled={mutation.pending}>
              <label className="field">
                <span>Senha atual *</span>
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  maxLength={512}
                />
              </label>
              <label className="field">
                <span>Nova senha *</span>
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <small className="field-help">Use de 8 a 128 caracteres.</small>
              </label>
            </fieldset>
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setChanging(false)}
                disabled={mutation.pending}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={mutation.pending}>
                Salvar nova senha
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}
