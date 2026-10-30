import { useCallback, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router"
import { UserRound, Save } from "lucide-react"
import type { ProfileView } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ImagePicker from "../../../shared/presentation/ImagePicker"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import PageHeading from "../../../shared/presentation/PageHeading"
import { formatField } from "../../../shared/presentation/form-validation/field-formatters"

export default function ProfilePage() {
  const services = useServices(),
    navigate = useNavigate(),
    mutation = useMutation()
  const [form, setForm] = useState<ProfileView | null>(null),
    [imageBusy, setImageBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [password, setPassword] = useState("")
  const load = useCallback(async () => {
    if (!services.auth || !services.profile)
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "O perfil está disponível na sua conta conectada.",
      )
    const session = await services.auth.session()
    if (!session.ok) return session
    return services.profile.read()
  }, [services.auth, services.profile])
  const resource = useResource(load),
    value = form ?? resource.data
  const emailChanged = !!value && value.email !== resource.data?.email
  if (
    resource.error?.code === "UNAUTHENTICATED" ||
    mutation.error?.code === "UNAUTHENTICATED"
  )
    return <Navigate to="/login" replace />
  if (resource.error?.code === "MFA_REQUIRED") return <Navigate to="/mfa" replace />
  if (resource.error?.code === "EMAIL_VERIFICATION_REQUIRED")
    return <Navigate to="/confirmar-email" replace />
  function edit(key: keyof ProfileView, text: string) {
    if (value) {
      setForm({ ...value, [key]: text })
      setSaved(false)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!value || !services.profile || imageBusy) return
    const changed = emailChanged
    const result = await mutation.run(() =>
      services.profile!.update({ ...value, currentPassword: password }),
    )
    if (result?.ok) {
      setPassword("")
      setForm(null)
      await resource.reload()
      setSaved(true)
      if (changed && services.auth) {
        const session = await services.auth.session()
        if (session.ok && session.value.emailVerification)
          navigate("/confirmar-email", { replace: true })
      }
    }
  }
  return (
    <main className="profile-page">
      <Link className="text-button" to="/admin">
        ← Voltar para minhas lojas
      </Link>
      <PageHeading
        eyebrow="Sua conta"
        title="Meu perfil"
        description="Mantenha seus dados de contato atualizados."
      />
      {resource.loading && <p role="status">Carregando seu perfil…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {value && (
        <ValidatedForm className="settings-form" onSubmit={(event) => void submit(event)}>
          <fieldset disabled={mutation.pending || resource.loading}>
            <div className="profile-avatar">
              {value.avatarUrl ? (
                <img src={value.avatarUrl} alt="Sua foto de perfil" />
              ) : (
                <UserRound size={40} aria-hidden="true" />
              )}
            </div>
            <ImagePicker
              label="Foto do perfil"
              value={value.avatarUrl}
              onChange={(text) => edit("avatarUrl", text)}
              reader={services.images}
              onBusyChange={setImageBusy}
            />
            <label className="field">
              <span>Nome completo *</span>
              <ValidatedInput
                name="name"
                autoComplete="name"
                validation="name"
                required
                maxLength={120}
                value={value.name}
                onChange={(event) => edit("name", event.target.value)}
              />
            </label>
            <label className="field">
              <span>E-mail *</span>
              <ValidatedInput
                name="email"
                type="email"
                autoComplete="email"
                validation="email"
                required
                maxLength={254}
                value={value.email}
                onChange={(event) => edit("email", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Celular com DDD</span>
              <ValidatedInput
                name="phone"
                type="tel"
                autoComplete="tel"
                validation="phone"
                maxLength={30}
                value={formatField(value.phone, "phone")}
                onChange={(event) => edit("phone", event.target.value)}
              />
            </label>
            {emailChanged && (
              <>
                <p className="info-notice">
                  Para proteger sua conta, confirme sua senha ao alterar o e-mail. As
                  outras sessões serão encerradas.
                </p>
                <label className="field">
                  <span>Senha atual *</span>
                  <ValidatedInput
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              </>
            )}
          </fieldset>
          {mutation.error && <ErrorNotice error={mutation.error} />}
          {saved && (
            <p className="success-notice" role="status">
              Seu perfil foi atualizado.
            </p>
          )}
          <div className="form-actions">
            <Link className="secondary-button" to="/admin">
              Voltar
            </Link>
            <button
              className="primary-button"
              disabled={mutation.pending || resource.loading || imageBusy}
            >
              <Save size={18} aria-hidden="true" />
              {mutation.pending ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </ValidatedForm>
      )}
    </main>
  )
}
