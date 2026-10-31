import { notifySuccess } from "../../../shared/presentation/notify"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { Link } from "react-router"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import type { Role, AppError } from "@cardapio/contracts"
import { can, roleLabels } from "@cardapio/domain/permissions"
import { ShieldCheck, UserRoundPlus, Trash2 } from "lucide-react"
import { useAccount } from "./AccountContext"
import { useServices } from "../../../app/presentation/ServicesProvider"
import type { TeamMember } from "../application/team"
import PageHeading from "../../../shared/presentation/PageHeading"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import { useMutation } from "../../../shared/presentation/use-mutation"
const descriptions: Record<Role, string> = {
  OWNER: "Configura a loja e controla os acessos da equipe.",
  MANAGER: "Gerencia a operação, consulta relatórios financeiros e reverte recebimentos.",
  CASHIER:
    "Atende pedidos, organiza entregas e registra recebimentos. Não reverte pagamentos nem acessa relatórios.",
  STAFF: "Atendimento legado: opera pedidos e entregas, sem acesso financeiro.",
  KITCHEN:
    "Consulta itens e observações; inicia preparo e marca como pronto. Contatos e endereços ficam ocultos.",
  COURIER: "Vê somente pedidos atribuídos a ele; informa saída e conclusão.",
  VIEWER:
    "Consulta catálogo e pedidos, sem alterações. Contatos e endereços ficam ocultos.",
}
export default function TeamPage() {
  const account = useAccount(),
    { team } = useServices(),
    mutation = useMutation(),
    [members, setMembers] = useState<TeamMember[]>([]),
    [error, setError] = useState<AppError | null>(null),
    [loading, setLoading] = useState(false),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<Exclude<Role, "OWNER">>("CASHIER"),
    [removing, setRemoving] = useState<TeamMember | null>(null)
  const tenantId = account?.restaurant.tenantId,
    allowed = can(account?.restaurant.role, "members:write")
  const reload = useCallback(async () => {
    if (!team || !tenantId || !allowed) return
    setLoading(true)
    const result = await team.list(tenantId)
    if (result.ok) {
      setMembers(result.value)
      setError(null)
    } else setError(result.error)
    setLoading(false)
  }, [team, tenantId, allowed])
  useEffect(() => {
    void reload()
  }, [reload])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!team || !tenantId) return
    const result = await mutation.run(() => team.save(tenantId, email, role))
    if (result?.ok) {
      setEmail("")
      notifySuccess("Acesso salvo. As permissões já estão em vigor.")
      await reload()
    }
  }
  async function remove() {
    if (!team || !tenantId || !removing) return
    const result = await mutation.run(() => team.remove(tenantId, removing.userId))
    if (result?.ok) {
      setRemoving(null)
      notifySuccess("Acesso removido da equipe.")
      await reload()
    }
  }
  return (
    <section>
      <PageHeading
        eyebrow="Cada pessoa, seu papel"
        title="Equipe e permissões"
        description="Acesso da equipe às lojas desta organização, com responsabilidades bem definidas."
      />
      {!allowed ? (
        <p className="info-notice">
          Somente o proprietário pode gerenciar os acessos da equipe.
        </p>
      ) : (
        <>
          {error && <ErrorNotice error={error} onRetry={() => void reload()} />}
          {mutation.error && <ErrorNotice error={mutation.error} />}
          <div className="team-layout">
            <ValidatedForm className="settings-card" onSubmit={(e) => void save(e)}>
              <UserRoundPlus size={26} />
              <h2>Adicionar ou alterar acesso</h2>
              <p>
                Informe o e-mail de uma conta já cadastrada. Para mudar o perfil, informe
                novamente o e-mail e selecione o novo papel.
              </p>
              <p className="field-help">
                Ainda não tem conta? A pessoa pode usar{" "}
                <Link to="/login?equipe=1" target="_blank" rel="noopener noreferrer">
                  o cadastro de equipe (nova aba)
                </Link>
                . Depois do cadastro, informe aqui o mesmo e-mail usado na conta.
              </p>
              <fieldset disabled={loading || mutation.pending}>
                <InputField
                  label="E-mail da conta"
                  type="email"
                  autoComplete="off"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <SelectField
                  label="Perfil de acesso"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Exclude<Role, "OWNER">)}
                >
                  {(["MANAGER", "CASHIER", "KITCHEN", "COURIER", "VIEWER"] as const).map(
                    (r) => (
                      <option value={r} key={r}>
                        {roleLabels[r]}
                      </option>
                    ),
                  )}
                </SelectField>
                <p className="field-help">{descriptions[role]}</p>
                <button className="primary-button" disabled={mutation.pending}>
                  {mutation.pending ? "Salvando…" : "Salvar acesso"}
                </button>
              </fieldset>
            </ValidatedForm>
            <section className="settings-card">
              <ShieldCheck size={26} />
              <h2>Pessoas com acesso</h2>
              {loading && <p role="status">Carregando equipe…</p>}
              <ul className="team-members">
                {members.map((member) => (
                  <li key={member.userId}>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{roleLabels[member.role]}</span>
                      <small>{descriptions[member.role]}</small>
                    </div>
                    {member.role !== "OWNER" && (
                      <button
                        className="icon-button"
                        aria-label={`Remover acesso de ${member.name}`}
                        disabled={mutation.pending}
                        onClick={() => setRemoving(member)}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {removing && (
            <Dialog
              title="Remover acesso"
              onClose={() => setRemoving(null)}
              busy={mutation.pending}
            >
              <div className="editor-form">
                <p>Remover o acesso de {removing.name} às lojas desta organização?</p>
                {mutation.error && <ErrorNotice error={mutation.error} />}
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    disabled={mutation.pending}
                    onClick={() => setRemoving(null)}
                  >
                    Manter acesso
                  </button>
                  <button
                    className="danger-button"
                    disabled={mutation.pending}
                    onClick={() => void remove()}
                  >
                    Remover acesso
                  </button>
                </div>
              </div>
            </Dialog>
          )}
        </>
      )}
    </section>
  )
}
