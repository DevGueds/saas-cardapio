import { currentPasswordField, currentLegalAcceptance } from "@cardapio/contracts"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react"
import Brand from "../../../shared/presentation/Brand"
import LegalLinks from "../../../shared/presentation/legal/LegalLinks"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import type { AppError } from "../../../shared/application/result"
import StoreFields from "./StoreFields"
import PasswordFields from "./PasswordFields"
import TurnstileChallenge from "../../../shared/presentation/TurnstileChallenge"
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
  const [configured, setConfigured] = useState(false),
    [siteKey, setSiteKey] = useState("")
  const [graceSeconds, setGraceSeconds] = useState(604800),
    [configAttempt, setConfigAttempt] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState(""),
    [challengeAttempt, setChallengeAttempt] = useState(0)
  const mutation = useMutation()
  useEffect(() => {
    let active = true
    if (auth)
      void auth.configuration().then((result) => {
        if (!active) return
        if (result.ok) {
          setSignupEnabled(result.value.signupEnabled)
          setSiteKey(result.value.turnstileSiteKey ?? "")
          setGraceSeconds(result.value.emailVerificationGraceSeconds ?? 604800)
          setConfigured(true)
          setConfigError(null)
          if (!result.value.signupEnabled) setSignup(false)
        } else setConfigError(result.error)
      })
    return () => {
      active = false
    }
  }, [auth, configAttempt])
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
    if (!configured || (siteKey && !turnstileToken)) return
    const credentials = {
      email: get("email"),
      password: get("password"),
      ...(turnstileToken ? { turnstileToken } : {}),
    }
    if (signup && get("legalAcceptance") !== "on") return
    const result = await mutation.run(() =>
      signup
        ? auth.register({
            ...credentials,
            name: get("name"),
            accountOnly,
            restaurantName: get("restaurantName"),
            slug: get("slug"),
            legalAcceptance: currentLegalAcceptance,
          })
        : auth.login(credentials),
    )
    if (result?.ok) {
      if (["ENROLL", "VERIFY"].includes(result.value.mfa ?? "")) {
        navigate("/mfa", { replace: true })
        return
      }
      if (signup || result.value.emailVerification?.required) {
        navigate("/confirmar-email", { replace: true })
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
    if (siteKey && result && !result.ok) {
      setTurnstileToken("")
      setChallengeAttempt((attempt) => attempt + 1)
    }
  }
  return (
    <main className="account-page">
      <section className="account-story" aria-label="Pede Aqui para sua loja">
        <Link to="/" className="account-brand">
          <Brand inverse />
        </Link>
        <div>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            Sua gestão, mais simples
          </p>
          <h1>
            Menos cliques.
            <br />
            <span>Mais controle.</span>
          </h1>
          <p>
            Organize seu cardápio, compartilhe o link com os clientes e acompanhe os
            pedidos em um só lugar.
          </p>
          <div className="account-workflow" aria-label="Organização do seu atendimento">
            <div>
              <span className="account-workflow__dot" />
              <strong>Do pedido ao pronto.</strong>
              <span>Sem complicar.</span>
            </div>
            <ol>
              <li>
                <span>01</span>Receber
              </li>
              <li>
                <span>02</span>Preparar
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Concluir
              </li>
            </ol>
            <small>Cardápio, pedidos e caixa. Tudo no mesmo lugar.</small>
          </div>
        </div>
        <small className="account-trust">
          <ShieldCheck size={17} aria-hidden="true" />
          Mais tempo para o que faz sua loja acontecer.
        </small>
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
          {configError && (
            <ErrorNotice
              error={configError}
              onRetry={() => setConfigAttempt((attempt) => attempt + 1)}
            />
          )}
          {!configured && !configError && <p role="status">Preparando acesso seguro…</p>}
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
              {signup ? (
                <PasswordFields key="signup-password" />
              ) : (
                <label className="field">
                  <span id="auth-password-label">Senha *</span>
                  <ValidatedInput
                    aria-labelledby="auth-password-label"
                    name="password"
                    schema={currentPasswordField}
                    type="password"
                    required
                    minLength={1}
                    autoComplete="current-password"
                  />
                </label>
              )}
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
              {signup && (
                <div className="legal-acceptance">
                  <label className="check-field">
                    <ValidatedInput type="checkbox" name="legalAcceptance" required />
                    <span>
                      Li e aceito os Termos de Uso e estou ciente da Política de
                      Privacidade.
                    </span>
                  </label>
                  <LegalLinks center={false} />
                </div>
              )}
              {signup && (
                <p className="field-help">
                  Você poderá usar sua conta por{" "}
                  {graceSeconds >= 86400
                    ? `${Math.round(graceSeconds / 86400)} dias`
                    : `${Math.round(graceSeconds / 3600)} horas`}{" "}
                  antes de confirmar o e-mail. Enviaremos um código de 6 números para
                  proteger seu acesso.
                </p>
              )}
              {siteKey && (
                <TurnstileChallenge
                  key={`${signup}-${challengeAttempt}`}
                  siteKey={siteKey}
                  action={signup ? "register" : "login"}
                  onToken={setTurnstileToken}
                />
              )}
            </fieldset>
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <button
              className="primary-button"
              disabled={mutation.pending || !configured || (!!siteKey && !turnstileToken)}
            >
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
                setTurnstileToken("")
                setSignup(!signup)
              }}
            >
              {signup
                ? "Já tenho conta. Quero entrar"
                : "Primeiro acesso? Criar minha conta"}
            </button>
          )}
          <footer className="account-legal">
            <LegalLinks />
            <p>Pede Aqui · Gestão simples, do seu jeito.</p>
          </footer>
        </div>
      </section>
    </main>
  )
}
