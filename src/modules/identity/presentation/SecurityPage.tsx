import { useCallback, useState, type FormEvent } from "react"
import { Link } from "react-router"
import { can, roleLabels, type Role } from "@cardapio/domain/permissions"
import type { MfaOverride } from "@cardapio/contracts"
import { useAccount } from "./AccountContext"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import PageHeading from "../../../shared/presentation/PageHeading"
import Dialog from "../../../shared/presentation/Dialog"
import "./security.css"
const labels = {
  INHERIT: "Seguir regra da loja",
  REQUIRED: "Sempre exigir",
  EXEMPT: "Dispensar exigência da loja",
}
export default function SecurityPage() {
  const { security } = useServices(),
    account = useAccount(),
    mutation = useMutation()
  const tenantId = account?.restaurant.tenantId,
    allowed = can(account?.restaurant.role, "security:write")
  const [change, setChange] = useState<
    { required: boolean } | { userId: string; name: string; override: MfaOverride } | null
  >(null)
  const load = useCallback(async () => {
    if (!allowed || !tenantId || !security)
      throw new Failure(
        "ACCESS_DENIED",
        "Somente a gestão pode alterar a segurança da equipe.",
      )
    return security.policy(tenantId)
  }, [allowed, tenantId, security])
  const resource = useResource(load),
    busy = resource.loading || !!resource.error || mutation.pending
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!change || !tenantId || !security) return
    const password = String(
      new FormData(event.currentTarget).get("currentPassword") ?? "",
    )
    const result = await mutation.run(
      () =>
        "required" in change
          ? security.changePolicy(tenantId, change.required, password)
          : security.changeMember(tenantId, change.userId, change.override, password),
      "Regra de segurança atualizada.",
    )
    if (result?.ok) {
      setChange(null)
      await resource.reload()
    }
  }
  return (
    <section>
      <PageHeading
        eyebrow="Acessos protegidos"
        title="Segurança da equipe"
        description="Controle a exigência da verificação em duas etapas nas lojas desta organização."
      />
      <div className="settings-card">
        <h2>Sua proteção pessoal</h2>
        <p>Ative primeiro a proteção da sua conta antes de exigi-la da equipe.</p>
        <Link className="secondary-button" to="/mfa">
          Gerenciar minha verificação em duas etapas
        </Link>
      </div>
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.loading && <p role="status">Carregando regras de segurança…</p>}
      {resource.data && (
        <>
          <div className="settings-card">
            <h2>Regra para toda a equipe</h2>
            <p>
              {resource.data.required
                ? "Exigir para todos, respeitando as exceções individuais abaixo."
                : "Não exigir por padrão. As pessoas marcadas como “Sempre exigir” continuam obrigadas."}
            </p>
            <p className="field-help">
              A mudança vale também para acessos já abertos. Quem precisar ativar o
              autenticador será orientado antes de entrar no painel.
            </p>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                mutation.clearError()
                setChange({ required: !resource.data!.required })
              }}
            >
              {resource.data.required
                ? "Retirar exigência geral"
                : "Exigir para toda a equipe"}
            </button>
          </div>
          <div className="settings-card">
            <h2>Exceções por pessoa</h2>
            <p>
              Dispensar a exigência permite que a pessoa desative a proteção na própria
              conta. Uma proteção pessoal já ativada ou exigida por outra organização é
              preservada.
            </p>
            <ul className="security-members">
              {resource.data.members.map((member) => (
                <li key={member.userId}>
                  <div>
                    <strong>{member.name}</strong>
                    <p>
                      {roleLabels[member.role as Role] ?? member.role} ·{" "}
                      {member.enabled
                        ? "Autenticador ativo"
                        : "Autenticador não configurado"}
                    </p>
                  </div>
                  <SelectField
                    label={`Exigência para ${member.name}`}
                    value={member.override}
                    disabled={
                      busy ||
                      (account?.restaurant.role === "MANAGER" && member.role === "OWNER")
                    }
                    onChange={(event) => {
                      mutation.clearError()
                      setChange({
                        userId: member.userId,
                        name: member.name,
                        override: event.target.value as MfaOverride,
                      })
                    }}
                  >
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {change && (
        <Dialog
          title="Confirmar mudança de segurança"
          busy={mutation.pending}
          onClose={() => setChange(null)}
        >
          <p>
            {"required" in change
              ? change.required
                ? "A equipe deverá configurar um aplicativo autenticador para acessar o painel. As exceções individuais serão respeitadas."
                : "A loja deixará de exigir a segunda etapa por padrão. Exigências individuais e proteções pessoais continuam ativas."
              : `${change.name}: ${labels[change.override]}.`}
          </p>
          <ValidatedForm className="editor-form" onSubmit={(event) => void save(event)}>
            <InputField
              label="Sua senha atual"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              disabled={mutation.pending}
            />
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={mutation.pending}
                onClick={() => setChange(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={mutation.pending}>
                Confirmar regra de segurança
              </button>
            </div>
          </ValidatedForm>
        </Dialog>
      )}
    </section>
  )
}
