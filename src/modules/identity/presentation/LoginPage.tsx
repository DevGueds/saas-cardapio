import { passwordField, currentPasswordField } from "@cardapio/contracts"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { ArrowRight, UtensilsCrossed } from "lucide-react"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import type { AppError } from "../../../shared/application/result"
import StoreFields from "./StoreFields"
export default function LoginPage() {
  const { auth } = useServices()
  const navigate = useNavigate(),
    location = useLocation()
  const [accountOnly, setAccountOnly] = useState(
    new URLSearchParams(location.search).get("equipe") === "1",
  )
  const [signup, setSignup] = useState(accountOnly),
    [signupEnabled, setSignupEnabled] = useState(false)
  const [configError, setConfigError] = useState<AppError | null>(null)
  const mutation = useMutation()
  useEffect(() => {
    let active = true
    if (auth)
      void auth.configuration().then((result) => {
        if (!active) return
        if (result.ok) setSignupEnabled(result.value.signupEnabled)
        else setConfigError(result.error)
      })
    return () => {
      active = false
    }
  }, [auth])
  if (!auth)
    return (
      <main className="state-page">
        <h1>Modo demonstração</h1>
        <Link className="primary-button" to="/admin">
          Acessar demonstração
        </Link>
      </main>
    )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) return
    const data = new FormData(event.currentTarget)
    const get = (key: string) => String(data.get(key) ?? "")
    const credentials = { email: get("email"), password: get("password") }
    const result = await mutation.run(() =>
      signup
        ? auth.register({
            ...credentials,
            name: get("name"),
            accountOnly,
            restaurantName: get("restaurantName"),
            slug: get("slug"),
          })
        : auth.login(credentials),
    )
    if (result?.ok) {
      if (["ENROLL", "VERIFY"].includes(result.value.mfa ?? "")) {
        navigate("/mfa", { replace: true })
        return
      }
      const returnTo: unknown = location.state?.returnTo
      navigate(
        typeof returnTo === "string" && /^\/admin(?:[/?]|$)/.test(returnTo)
          ? returnTo
          : "/admin",
        { replace: true },
      )
    }
  }
  return (
    <main className="account-page">
      <section className="account-story" aria-label="Cardápio para restaurantes">
        <Link to="/" className="account-brand">
          <UtensilsCrossed size={28} aria-hidden="true" />
          Cardápio
        </Link>
        <div>
          <p className="eyebrow">Seu restaurante, conectado</p>
          <h1>
            Menos complicação.
            <br />
            Mais tempo para sua loja.
          </h1>
          <p>
            Organize seu cardápio, compartilhe o link com os clientes e acompanhe os
            pedidos em um só lugar.
          </p>
        </div>
        <small>Uma conta. Suas lojas. Tudo organizado.</small>
      </section>
      <section className="account-panel" aria-labelledby="account-title">
        <div className="account-card">
          <p className="eyebrow">Área da loja</p>
          <h2 id="account-title">
            {signup
              ? accountOnly
                ? "Vamos entrar na equipe?"
                : "Vamos abrir sua loja?"
              : "Bom ter você por aqui"}
          </h2>
          <p className="page-description">
            {signup
              ? accountOnly
                ? "Crie sua conta pessoal. O proprietário poderá liberar seu acesso pelo e-mail cadastrado."
                : "Crie sua conta e comece com um cardápio vazio. Você abre a loja quando estiver tudo pronto."
              : "Entre para cuidar do cardápio e acompanhar os pedidos."}
          </p>
          {configError && <ErrorNotice error={configError} />}
          <ValidatedForm
            className="account-form"
            onSubmit={(event) => void submit(event)}
          >
            <fieldset disabled={mutation.pending}>
              {signup && (
                <label className="field">
                  <span>Seu nome *</span>
                  <ValidatedInput
                    name="name"
                    validation="personName"
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="field">
                <span>E-mail *</span>
                <ValidatedInput
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete={signup ? "email" : "username"}
                  autoCapitalize="none"
                />
              </label>
              <label className="field">
                <span id="auth-password-label">Senha *</span>
                <ValidatedInput
                  aria-labelledby="auth-password-label"
                  name="password"
                  schema={signup ? passwordField : currentPasswordField}
                  type="password"
                  required
                  minLength={signup ? 8 : 1}
                  autoComplete={signup ? "new-password" : "current-password"}
                  aria-describedby={signup ? "password-help" : undefined}
                />
                {signup && (
                  <small className="field-help" id="password-help">
                    Use de 8 a 128 caracteres. Você pode usar uma frase como senha.
                  </small>
                )}
              </label>
              {signup && (
                <label className="check-field">
                  <ValidatedInput
                    type="checkbox"
                    checked={accountOnly}
                    onChange={(e) => setAccountOnly(e.target.checked)}
                  />{" "}
                  Faço parte de uma equipe; não quero criar uma loja
                </label>
              )}
              {signup && !accountOnly && <StoreFields />}
            </fieldset>
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <button className="primary-button" disabled={mutation.pending}>
              {mutation.pending
                ? "Aguarde…"
                : signup
                  ? accountOnly
                    ? "Criar minha conta de equipe"
                    : "Criar conta e loja"
                  : "Entrar na minha conta"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </ValidatedForm>
          {signupEnabled && (
            <button
              className="text-button"
              disabled={mutation.pending}
              onClick={() => {
                mutation.clearError()
                setSignup(!signup)
              }}
            >
              {signup
                ? "Já tenho conta. Quero entrar"
                : "Primeiro acesso? Criar minha conta"}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
