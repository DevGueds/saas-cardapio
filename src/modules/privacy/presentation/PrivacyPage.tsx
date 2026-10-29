import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router"
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"
import {
  currentLegalAcceptance,
  currentPasswordField,
  LEGAL_VERSION,
  privacyController,
  privacyRequestInputSchema,
  type AppError,
  type PrivacyProfile,
  type PrivacyRequest,
} from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useMutation } from "../../../shared/presentation/use-mutation"
import Brand from "../../../shared/presentation/Brand"
import LegalLinks from "../../../shared/presentation/legal/LegalLinks"
import { useLegal } from "../../../shared/presentation/legal/LegalProvider"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import ValidatedSelect from "../../../shared/presentation/form-validation/ValidatedSelect"
import ValidatedTextarea from "../../../shared/presentation/form-validation/ValidatedTextarea"

const labels: Record<PrivacyRequest["kind"], string> = {
  ACCESS: "Acesso aos dados",
  CORRECTION: "Correção de dados",
  DELETION: "Eliminação ou encerramento",
  INFORMATION: "Informações sobre o tratamento",
  OBJECTION: "Oposição ao tratamento",
  CONSENT: "Revogação de consentimento",
}
const statuses: Record<PrivacyRequest["status"], string> = {
  RECEIVED: "Recebida",
  IN_REVIEW: "Em análise",
  COMPLETED: "Concluída",
  DECLINED: "Respondida com justificativa",
}
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value))
export default function PrivacyPage() {
  const { privacy, auth, files, mode } = useServices()
  const legal = useLegal(),
    mutation = useMutation()
  const [profile, setProfile] = useState<PrivacyProfile | null>(null)
  const [loading, setLoading] = useState(!!privacy)
  const [error, setError] = useState<AppError | null>(null)
  const reload = useCallback(async () => {
    if (!privacy || !auth) return
    setLoading(true)
    const session = await auth.session()
    if (!session.ok) {
      setProfile(null)
      setError(session.error.code === "UNAUTHENTICATED" ? null : session.error)
      setLoading(false)
      return
    }
    const result = await privacy.profile()
    if (result.ok) {
      setProfile(result.value)
      setError(null)
    } else setError(result.error)
    setLoading(false)
  }, [auth, privacy])
  useEffect(() => {
    document.title = "Privacidade e seus dados · Pede Aqui"
    void reload()
  }, [reload])
  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!privacy || !files) return
    const form = event.currentTarget,
      data = new FormData(form)
    const result = await mutation.run(async () => {
      const exported = await privacy.export({
        currentPassword: String(data.get("currentPassword") ?? ""),
      })
      if (!exported.ok) return exported
      return files.json(
        `pede-aqui-meus-dados-${exported.value.generatedAt.slice(0, 10)}.json`,
        exported.value,
      )
    }, "Arquivo preparado. Confira os downloads do seu navegador.")
    if (result?.ok) form.reset()
  }
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!privacy) return
    const form = event.currentTarget,
      data = new FormData(form)
    const input = privacyRequestInputSchema.safeParse({
      kind: data.get("kind"),
      message: String(data.get("message") ?? ""),
    })
    if (!input.success) return
    const result = await mutation.run(
      () => privacy.request(input.data),
      "Solicitação registrada. Acompanhe o protocolo nesta página.",
    )
    if (result?.ok) {
      setProfile((previous) =>
        previous
          ? { ...previous, requests: [result.value, ...previous.requests].slice(0, 100) }
          : previous,
      )
      form.reset()
    }
  }
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!privacy) return
    const result = await mutation.run(
      () => privacy.accept(currentLegalAcceptance),
      "Seu aceite foi registrado.",
    )
    if (result?.ok) await reload()
  }
  const current =
    profile?.acceptance?.termsVersion === LEGAL_VERSION &&
    profile.acceptance.privacyVersion === LEGAL_VERSION
  return (
    <main className="privacy-page">
      <header className="privacy-page__nav">
        <Link to="/" aria-label="Pede Aqui, início">
          <Brand />
        </Link>
        <Link to={profile ? "/admin" : "/login"}>
          <ArrowLeft size={16} aria-hidden="true" />
          {profile ? "Voltar para a loja" : "Acessar minha conta"}
        </Link>
      </header>
      <section className="privacy-hero" aria-labelledby="privacy-title">
        <span className="privacy-hero__badge">
          <ShieldCheck size={15} aria-hidden="true" />
          Privacidade e proteção de dados
        </span>
        <h1 id="privacy-title">
          Seus dados.
          <br />
          Suas escolhas.
        </h1>
        <p>
          Informação clara, controle nas suas mãos e um canal direto com a gente. Conheça
          nossos compromissos e exerça seus direitos.
        </p>
      </section>
      <section className="privacy-documents" aria-label="Documentos do Pede Aqui">
        <article className="privacy-document-card">
          <FileText aria-hidden="true" />
          <h2>Termos de Uso</h2>
          <p>As regras do serviço, as responsabilidades da loja e os seus direitos.</p>
          <button onClick={() => legal.open("terms")}>
            Ler os termos
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </article>
        <article className="privacy-document-card">
          <ShieldCheck aria-hidden="true" />
          <h2>Política de Privacidade</h2>
          <p>
            O que tratamos, por qual motivo e com quem as informações são compartilhadas.
          </p>
          <button onClick={() => legal.open("privacy")}>
            Conhecer a política
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </article>
        <article className="privacy-document-card">
          <SlidersHorizontal aria-hidden="true" />
          <h2>Dados do dispositivo</h2>
          <p>
            Entenda os cookies essenciais e limpe os dados de preenchimento salvos nesta
            aba.
          </p>
          <button onClick={() => legal.open("cookies")}>
            Ver meus controles
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </article>
      </section>
      <section className="privacy-account" aria-labelledby="privacy-account-title">
        <h2 id="privacy-account-title">Sua conta, com transparência</h2>
        {loading && (
          <p role="status" className="page-description">
            Consultando seus dados…
          </p>
        )}
        {error && <ErrorNotice error={error} onRetry={() => void reload()} />}
        {!loading && !error && !profile && (
          <>
            <p className="page-description">
              {mode === "api"
                ? "Entre para consultar seus dados de conta, baixar uma cópia e acompanhar suas solicitações. Para um pedido feito sem conta, fale com a loja ou use o contato abaixo."
                : "Nesta demonstração, os dados ficam no navegador. Você pode limpar o preenchimento em Dados do dispositivo ou falar diretamente com nosso canal de privacidade."}
            </p>
            {mode === "api" && (
              <Link
                className="primary-button"
                to="/login"
                style={{ marginTop: "1.25rem" }}
              >
                Entrar na minha conta
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
          </>
        )}
        {profile && (
          <>
            <div className="privacy-account__identity">
              <div>
                <strong>{profile.account.name}</strong>
                <small>{profile.account.email}</small>
              </div>
              <small>Conta criada em {date(profile.account.createdAt)}</small>
            </div>
            {current ? (
              <p className="success-notice">
                Documentos atuais lidos e aceitos em{" "}
                {date(profile.acceptance!.acceptedAt)}.
              </p>
            ) : (
              <ValidatedForm
                className="legal-acceptance"
                onSubmit={(event) => void accept(event)}
              >
                <p className="page-description">
                  Os documentos atuais estão disponíveis acima. Confirme sua leitura para
                  registrar a versão vigente.
                </p>
                <label className="check-field">
                  <ValidatedInput type="checkbox" name="legalAcceptance" required />
                  <span>
                    Li e aceito os Termos de Uso e estou ciente da Política de
                    Privacidade.
                  </span>
                </label>
                <button className="secondary-button" disabled={mutation.pending}>
                  Registrar meu aceite
                </button>
              </ValidatedForm>
            )}
            <div className="privacy-account__grid">
              <section>
                <h3>Baixar uma cópia dos meus dados</h3>
                <p>
                  Receba um arquivo JSON com sua conta, vínculos, histórico de
                  solicitações, aceites e registros de segurança. Não inclui senhas,
                  segredos ou dados de clientes de outras pessoas.
                </p>
                <ValidatedForm onSubmit={(event) => void download(event)}>
                  <label className="field">
                    <span>Confirme sua senha atual *</span>
                    <ValidatedInput
                      type="password"
                      name="currentPassword"
                      schema={currentPasswordField}
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <button className="secondary-button" disabled={mutation.pending}>
                    <Download size={17} aria-hidden="true" />
                    {mutation.pending ? "Aguarde…" : "Preparar minha cópia"}
                  </button>
                </ValidatedForm>
              </section>
              <section>
                <h3>Exercer um direito</h3>
                <p>
                  Registre seu pedido. A equipe verificará a solicitação e as obrigações
                  de conservação aplicáveis. Pedir eliminação não encerra nem apaga
                  automaticamente a conta.
                </p>
                <ValidatedForm onSubmit={(event) => void request(event)}>
                  <label className="field">
                    <span>O que você precisa? *</span>
                    <ValidatedSelect
                      name="kind"
                      schema={privacyRequestInputSchema.shape.kind}
                      required
                    >
                      {Object.entries(labels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </ValidatedSelect>
                  </label>
                  <label className="field">
                    <span>Detalhes do pedido</span>
                    <ValidatedTextarea
                      name="message"
                      maxLength={1200}
                      schema={privacyRequestInputSchema.shape.message}
                      rows={3}
                      placeholder="Explique apenas o necessário. Não envie senhas ou documentos sensíveis."
                    />
                  </label>
                  <button className="primary-button" disabled={mutation.pending}>
                    {mutation.pending ? "Aguarde…" : "Registrar solicitação"}
                  </button>
                </ValidatedForm>
              </section>
            </div>
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <section className="privacy-history" aria-label="Suas solicitações">
              <h3>Acompanhe suas solicitações</h3>
              {profile.requests.length === 0 ? (
                <p className="page-description">
                  Você ainda não tem solicitações registradas.
                </p>
              ) : (
                <ol>
                  {profile.requests.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{labels[item.kind]}</strong>
                        <span>{statuses[item.status]}</span>
                      </div>
                      <small>
                        Protocolo {item.id} · {date(item.createdAt)}
                      </small>
                      {item.response && <p>{item.response}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <button
                className="text-button"
                disabled={loading || mutation.pending}
                onClick={() => void reload()}
              >
                Atualizar acompanhamento
              </button>
            </section>
          </>
        )}
      </section>
      <section className="privacy-contact" aria-labelledby="privacy-contact-title">
        <h2 id="privacy-contact-title">Um canal direto com a gente</h2>
        <p>
          Para questões de dados pessoais, solicitações sem conta ou acompanhamento de um
          protocolo, escreva para{" "}
          <a href={`mailto:${privacyController.email}`}>
            <Mail size={15} aria-hidden="true" /> {privacyController.email}
          </a>
          . Você não precisa enviar sua senha ou uma cópia de documento no primeiro
          contato.
        </p>
        <p>
          <strong>{privacyController.legalName}</strong>
          <br />
          CNPJ {privacyController.document} · Responsável pela operação do Pede Aqui
        </p>
        <p>
          O atendimento de confirmação e acesso observa o art. 19 da LGPD. Solicitações
          sobre compras e entregas devem ser direcionadas também ao estabelecimento
          responsável pelo pedido.
        </p>
      </section>
      <footer className="privacy-page__footer">
        <span>Pede Aqui · Menos cliques. Mais controle.</span>
        <LegalLinks />
      </footer>
    </main>
  )
}
