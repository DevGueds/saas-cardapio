import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"
import { MailCheck, ShieldCheck } from "lucide-react"
import { emailCodeSchema, type EmailVerificationView } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"

export default function EmailVerificationPage() {
  const { auth } = useServices(),
    navigate = useNavigate(),
    location = useLocation()
  const mutation = useMutation()
  const [retryAt, setRetryAt] = useState(0),
    [now, setNow] = useState(Date.now)
  const [sent, setSent] = useState(false),
    [confirmed, setConfirmed] = useState(false)
  const load = useCallback(async () => {
    if (!auth)
      throw new Failure(
        "CONFIGURATION",
        "A confirmação de e-mail está disponível no ambiente conectado.",
      )
    const session = await auth.session()
    if (!session.ok) return session
    if (["ENROLL", "VERIFY"].includes(session.value.mfa ?? ""))
      return { ok: true as const, value: { mfa: true, verification: null } }
    if (!session.value.emailVerification)
      return { ok: true as const, value: { mfa: false, verification: null } }
    const status = await auth.emailStatus()
    if (!status.ok) return status
    return { ok: true as const, value: { mfa: false, verification: status.value } }
  }, [auth])
  const resource = useResource<{
    mfa: boolean
    verification: EmailVerificationView | null
  }>(load)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const verification = resource.data?.verification
  const remaining = Math.max(
    0,
    Math.ceil(
      (Math.max(retryAt, Date.parse(verification?.retryAt ?? "") || 0) - now) / 1000,
    ),
  )
  const verified = confirmed || verification?.verified
  const codeIssued = sent || !!verification?.retryAt
  const required =
    verification &&
    !verified &&
    (verification.required || now >= Date.parse(verification.deadline))
  const returnTo: unknown = location.state?.returnTo
  const destination =
    typeof returnTo === "string" && /^\/admin(?:[/?]|$)/.test(returnTo)
      ? returnTo
      : "/admin"
  if (
    resource.error?.code === "UNAUTHENTICATED" ||
    mutation.error?.code === "UNAUTHENTICATED"
  )
    return <Navigate to="/login" replace />
  if (resource.data?.mfa || mutation.error?.code === "MFA_REQUIRED")
    return <Navigate to="/mfa" replace />
  if (resource.data && !resource.data.mfa && !resource.data.verification)
    return <Navigate to={destination} replace />
  async function send() {
    if (!auth) return
    const result = await mutation.run(() => auth.sendEmailCode())
    if (result?.ok) {
      setSent(result.value.sent)
      setRetryAt(Date.parse(result.value.retryAt))
      if (!result.value.sent) await resource.reload()
    }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth) return
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
    const result = await mutation.run(() => auth.confirmEmail(code))
    if (result?.ok) setConfirmed(true)
  }
  async function logout() {
    if (!auth) return
    const result = await mutation.run(() => auth.logout())
    if (result?.ok) navigate("/login", { replace: true })
  }
  return (
    <main className="email-verification-page">
      <section
        className="account-card email-verification-card"
        aria-labelledby="email-title"
      >
        {verified ? (
          <ShieldCheck size={36} aria-hidden="true" />
        ) : (
          <MailCheck size={36} aria-hidden="true" />
        )}
        <p className="eyebrow">Proteção da sua conta</p>
        <h1 id="email-title">
          {verified ? "E-mail confirmado!" : "Confirme seu e-mail"}
        </h1>
        {resource.loading && <p role="status">Carregando confirmação…</p>}
        {resource.error && (
          <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
        )}
        {verification && !verified && (
          <>
            <p>
              {codeIssued
                ? "Use o código de 6 números enviado para "
                : "Solicite um código de 6 números para "}
              <strong className="email-address">{verification.email}</strong>.
            </p>
            <p className="field-help">
              {required
                ? "O prazo de confirmação terminou. Confirme seu e-mail para voltar ao painel; seus dados continuam salvos."
                : `Você já pode usar o app. Confirme seu e-mail até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(verification.deadline))} para manter seu acesso.`}
            </p>
            <ValidatedForm
              className="account-form"
              onSubmit={(event) => void confirm(event)}
            >
              <fieldset
                disabled={mutation.pending || resource.loading || !!resource.error}
              >
                <label className="field">
                  <span>Código de confirmação *</span>
                  <ValidatedInput
                    name="code"
                    schema={emailCodeSchema.shape.code}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    aria-describedby="email-code-help"
                  />
                </label>
                <small className="field-help" id="email-code-help">
                  O código expira em 10 minutos. Confira também o spam. Ao solicitar outro
                  código, o anterior deixa de funcionar.
                </small>
              </fieldset>
              <button
                className="primary-button"
                disabled={mutation.pending || resource.loading || !!resource.error}
              >
                {mutation.pending ? "Aguarde…" : "Confirmar meu e-mail"}
              </button>
            </ValidatedForm>
            <button
              type="button"
              className="secondary-button"
              disabled={
                mutation.pending || remaining > 0 || resource.loading || !!resource.error
              }
              onClick={() => void send()}
            >
              {remaining > 0
                ? `Novo código em ${remaining}s`
                : codeIssued
                  ? "Enviar novo código"
                  : "Enviar código"}
            </button>
            {sent && (
              <p className="success-notice" role="status">
                Código enviado. Confira sua caixa de entrada e o spam.
              </p>
            )}
            {!required && (
              <Link className="text-button" to={destination}>
                Confirmar depois e acessar o app
              </Link>
            )}
          </>
        )}
        {verified && (
          <>
            <p role="status">
              Seu e-mail está confirmado. Sua conta está mais protegida.
            </p>
            <Link className="primary-button" to={destination}>
              Continuar para o app
            </Link>
          </>
        )}
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <button
          className="text-button"
          type="button"
          disabled={mutation.pending}
          onClick={() => void logout()}
        >
          Sair da conta
        </button>
      </section>
    </main>
  )
}
