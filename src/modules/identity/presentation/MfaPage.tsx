import { useCallback, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router"
import { ShieldCheck } from "lucide-react"
import { mfaCodeSchema, type MfaSetup } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import { InputField, ToggleField } from "../../../shared/presentation/Fields"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import Dialog from "../../../shared/presentation/Dialog"
import "./security.css"

export default function MfaPage() {
  const { auth, security } = useServices(),
    navigate = useNavigate(),
    mutation = useMutation()
  const [setup, setSetup] = useState<MfaSetup | null>(null),
    [codes, setCodes] = useState<string[] | null>(null),
    [saved, setSaved] = useState(false),
    [disabling, setDisabling] = useState(false)
  const load = useCallback(async () => {
    if (!auth || !security)
      throw new Failure(
        "CONFIGURATION",
        "A proteção de contas está disponível no ambiente conectado à API.",
      )
    const session = await auth.session()
    if (!session.ok) return session
    const status = await security.status()
    return status.ok
      ? { ok: true as const, value: { session: session.value, status: status.value } }
      : status
  }, [auth, security])
  const resource = useResource(load)
  if (resource.error?.code === "UNAUTHENTICATED" || mutation.error?.code === "UNAUTHENTICATED") return <Navigate to="/login" replace />
  const pending = ["ENROLL", "VERIFY"].includes(resource.data?.session.mfa ?? "")
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(
      new FormData(event.currentTarget).get("currentPassword") ?? "",
    )
    const result = await mutation.run(() => security!.setup(password))
    if (result?.ok) setSetup(result.value)
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
    const result = await mutation.run(() => security!.verify(code))
    if (result?.ok) {
      setSetup(null)
      if (result.value.recoveryCodes.length) setCodes(result.value.recoveryCodes)
      else navigate("/admin", { replace: true })
    }
  }
  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const result = await mutation.run(() =>
      security!.disable(
        String(data.get("currentPassword") ?? ""),
        String(data.get("code") ?? ""),
      ),
    )
    if (result?.ok) navigate("/login", { replace: true })
  }
  async function logout() {
    const result = await mutation.run(() => auth!.logout())
    if (result?.ok) navigate("/login", { replace: true })
  }
  return (
    <main className="security-page">
      <section className="settings-card security-card">
        <ShieldCheck size={32} aria-hidden="true" />
        <p className="eyebrow">Proteção da sua conta</p>
        <h1>
          {codes
            ? "Guarde seus códigos de recuperação"
            : pending
              ? "Confirme seu acesso"
              : "Verificação em duas etapas"}
        </h1>
        {resource.error && (
          <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
        )}
        {resource.loading && <p role="status">Carregando proteção da conta…</p>}
        {mutation.error && !disabling && <ErrorNotice error={mutation.error} />}
        {codes ? (
          <>
            <p>
              Use um destes códigos se perder o celular. Cada código funciona uma única
              vez. Guarde-os num gerenciador de senhas ou em um local seguro: eles não
              serão mostrados novamente.
            </p>
            <p className="field-help">
              Não compartilhe estes códigos. Recarregar ou sair desta página os remove da
              tela.
            </p>
            <ul className="recovery-codes">
              {codes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
            <ToggleField
              label="Guardei meus códigos em um local seguro"
              checked={saved}
              onChange={setSaved}
            />
            <button
              className="primary-button"
              disabled={!saved}
              onClick={() => navigate("/admin", { replace: true })}
            >
              Continuar para minhas lojas
            </button>
          </>
        ) : (
          resource.data &&
          !resource.error && (
            <>
              {!resource.data.status.enabled && !setup && (
                <>
                  <p>
                    {resource.data.status.required
                      ? "Sua loja exige uma segunda etapa de proteção. Configure um aplicativo autenticador para abrir o painel."
                      : "Adicione um código temporário à sua senha. Use um aplicativo autenticador, como Microsoft Authenticator, Google Authenticator ou 2FAS."}
                  </p>
                  <p className="field-help">
                    Sem SMS e sem cobrança por código. A configuração leva poucos minutos.
                  </p>
                  <ValidatedForm
                    onSubmit={(event) => void start(event)}
                    className="editor-form"
                  >
                    <PasswordField disabled={mutation.pending} />
                    <button className="primary-button" disabled={mutation.pending}>
                      {mutation.pending
                        ? "Preparando…"
                        : "Configurar aplicativo autenticador"}
                    </button>
                  </ValidatedForm>
                </>
              )}
              {setup && (
                <>
                  <ol>
                    <li>
                      Abra seu aplicativo autenticador e escolha adicionar uma conta.
                    </li>
                    <li>
                      Leia o QR Code abaixo. Se estiver no mesmo celular, cadastre a chave
                      manualmente.
                    </li>
                    <li>Digite o código de 6 dígitos mostrado pelo aplicativo.</li>
                  </ol>
                  <img
                    className="mfa-qr"
                    src={setup.qr}
                    alt="QR Code para configurar seu aplicativo autenticador"
                    width={280}
                    height={280}
                  />
                  <InputField
                    label="Chave para cadastro manual"
                    value={setup.secret}
                    readOnly
                    autoComplete="off"
                    onFocus={(event) => event.target.select()}
                  />
                  <p className="field-help">
                    Configuração válida por 10 minutos. Esta chave é pessoal; não envie a
                    outras pessoas.
                  </p>
                  <button className="text-button" disabled={mutation.pending} onClick={() => { setSetup(null); mutation.clearError() }}>Gerar nova configuração</button>
                </>
              )}
              {(setup || resource.data.session.mfa === "VERIFY") && (
                <ValidatedForm
                  onSubmit={(event) => void verify(event)}
                  className="editor-form"
                >
                  {!setup && (
                    <p>
                      Abra seu aplicativo autenticador e digite o código da conta
                      Cardápio. Se perdeu o celular, use um dos códigos de recuperação que
                      guardou.
                    </p>
                  )}
                  <InputField
                    label={
                      setup
                        ? "Código do aplicativo"
                        : "Código do aplicativo ou de recuperação"
                    }
                    name="code"
                    schema={mfaCodeSchema}
                    required
                    maxLength={24}
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={mutation.pending}
                    help="Cada código só pode ser usado uma vez. Se acabou de usá-lo, aguarde o próximo."
                  />
                  <button className="primary-button" disabled={mutation.pending}>
                    {mutation.pending
                      ? "Verificando…"
                      : setup
                        ? "Ativar proteção"
                        : "Confirmar e entrar"}
                  </button>
                </ValidatedForm>
              )}
              {resource.data.status.enabled && !pending && (
                <>
                  <p className="info-notice">
                    Sua conta está protegida. {resource.data.status.recoveryRemaining}{" "}
                    códigos de recuperação disponíveis.
                  </p>
                  <p>
                    {resource.data.status.required
                      ? "Uma das suas lojas exige esta proteção. Somente a gestão pode retirar essa exigência."
                      : "Se precisar trocar de aplicativo, desative a proteção e configure novamente. A desativação encerra todas as suas sessões."}
                  </p>
                  <button
                    className="secondary-button"
                    disabled={resource.data.status.required || mutation.pending}
                    onClick={() => {
                      mutation.clearError()
                      setDisabling(true)
                    }}
                  >
                    Desativar proteção da minha conta
                  </button>
                </>
              )}
              {!pending && (
                <Link className="secondary-button" to="/admin">
                  Voltar para minhas lojas
                </Link>
              )}
              <button
                className="text-button"
                disabled={mutation.pending}
                onClick={() => void logout()}
              >
                Sair da conta
              </button>
            </>
          )
        )}
      </section>
      {disabling && (
        <Dialog
          title="Desativar a verificação em duas etapas?"
          busy={mutation.pending}
          onClose={() => setDisabling(false)}
        >
          <p>
            Você voltará a entrar apenas com a senha. Todas as sessões serão encerradas, e
            os códigos de recuperação deixarão de funcionar.
          </p>
          <ValidatedForm
            className="editor-form"
            onSubmit={(event) => void disable(event)}
          >
            <PasswordField disabled={mutation.pending} />
            <InputField
              label="Código do aplicativo ou de recuperação"
              name="code"
              schema={mfaCodeSchema}
              required
              maxLength={24}
              autoComplete="one-time-code"
              disabled={mutation.pending}
            />
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={mutation.pending}
                onClick={() => setDisabling(false)}
              >
                Manter proteção
              </button>
              <button className="primary-button" disabled={mutation.pending}>
                Confirmar desativação
              </button>
            </div>
          </ValidatedForm>
        </Dialog>
      )}
    </main>
  )
}
function PasswordField({ disabled }: { disabled: boolean }) {
  return (
    <InputField
      label="Sua senha atual"
      name="currentPassword"
      type="password"
      required
      autoComplete="current-password"
      disabled={disabled}
    />
  )
}
