import { useCallback, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { can } from "@cardapio/domain/permissions"
import { reportRangeSchema, type ReportRange } from "@cardapio/contracts"
import { Plus, RefreshCw, Wallet } from "lucide-react"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import PageHeading from "../../../shared/presentation/PageHeading"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import { InputField } from "../../../shared/presentation/Fields"
import { useResource } from "../../../shared/presentation/use-resource"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"
import PaymentForm from "./PaymentForm"
import PaymentHistory from "./PaymentHistory"
import FinancialReport from "./FinancialReport"
import { dateRange, financeTime, today } from "./payment-labels"

export default function FinancePage() {
  const account = useAccount(),
    { payments } = useServices(),
    { menu } = useMenu()
  if (!payments || !can(account?.restaurant.role, "payments:read"))
    return (
      <section className="info-notice">
        <h1>Caixa e relatórios</h1>
        <p>
          Esta área está disponível para caixa, gerente e proprietário em uma loja
          conectada.
        </p>
        <Link to={`/admin/orders?restaurant=${menu.restaurant.id}`}>
          Voltar aos pedidos
        </Link>
      </section>
    )
  return <FinanceWorkspace key={menu.restaurant.id} />
}
function FinanceWorkspace() {
  const { menu } = useMenu(),
    account = useAccount()
  const [params, setParams] = useSearchParams()
  const reports = can(account?.restaurant.role, "reports:read")
  const tab = params.get("tab") === "reports" && reports ? "reports" : "payments"
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today)
  const [range, setRange] = useState(() => dateRange(from, to))
  const [rangeError, setRangeError] = useState("")
  const [refresh, setRefresh] = useState(0)
  return (
    <section className="finance-page">
      <PageHeading
        eyebrow="Gestão financeira"
        title="Caixa e relatórios"
        description="Receba, confira e acompanhe sua operação em um só lugar."
      />
      <div className="live-order-tabs" role="group" aria-label="Área financeira">
        {[
          ["payments", "Recebimentos"],
          ...(reports ? [["reports", "Relatórios"]] : []),
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set("tab", value!)
                return next
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <ValidatedForm
        className="finance-filters"
        onSubmit={(event) => {
          event.preventDefault()
          try {
            const parsed = reportRangeSchema.safeParse(dateRange(from, to))
            if (!parsed.success) {
              setRangeError(
                "Selecione até 31 dias, com data final igual ou posterior à inicial.",
              )
              return
            }
            setRangeError("")
            setRange(parsed.data)
            setRefresh((v) => v + 1)
          } catch {
            setRangeError("Preencha as duas datas do período.")
          }
        }}
      >
        <InputField
          label="Data inicial"
          type="date"
          required
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <InputField
          label="Data final"
          type="date"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button type="submit" className="secondary-button">
          <RefreshCw size={17} aria-hidden="true" />
          Aplicar período
        </button>
        <p className="field-help">
          Datas inclusivas · fuso fixo UTC−03 · até 31 dias por consulta
        </p>
      </ValidatedForm>
      {rangeError && (
        <p className="error-notice" role="alert">
          {rangeError}
        </p>
      )}
      <p className="field-help">
        Período aplicado: {financeTime(range.from)} até{" "}
        {financeTime(new Date(Date.parse(range.to) - 1).toISOString())} (UTC−03).
      </p>
      <FeatureBoundary
        label={tab === "reports" ? "Relatório gerencial" : "Histórico de recebimentos"}
        resetKeys={[tab, range.from, range.to]}
      >
        {tab === "reports" ? (
          <FinancialReport
            key={`${range.from}:${range.to}:${refresh}`}
            restaurantId={menu.restaurant.id}
            restaurantName={menu.restaurant.name}
            range={range}
          />
        ) : (
          <Receipts
            key={`${range.from}:${range.to}:${refresh}`}
            restaurantId={menu.restaurant.id}
            range={range}
          />
        )}
      </FeatureBoundary>
    </section>
  )
}
function Receipts({ restaurantId, range }: { restaurantId: string; range: ReportRange }) {
  const { payments } = useServices(),
    account = useAccount()
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    cursor = cursors.at(-1)
  const [creating, setCreating] = useState(false)
  const load = useCallback(
    () => payments!.list(restaurantId, range, cursor),
    [payments, restaurantId, range, cursor],
  )
  const resource = useResource(load)
  return (
    <section>
      <div className="finance-section-heading">
        <div>
          <h2>
            <Wallet size={21} aria-hidden="true" />
            Recebimentos
          </h2>
          <p>Registros manuais, sem movimentação bancária automática.</p>
        </div>
        {can(account?.restaurant.role, "payments:write") && (
          <button
            type="button"
            className="primary-button"
            disabled={resource.loading || !!resource.error}
            onClick={() => setCreating(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Recebimento avulso
          </button>
        )}
      </div>
      <p className="field-help">
        Para dar baixa em um pedido, abra seus detalhes no quadro de pedidos. Esta lista
        inclui recebimentos ou reversões ocorridos no período, inclusive avulsos e pedidos
        de outras datas. Situação é a atual; as colunas de entrada/reversão mostram apenas
        o efeito no período aplicado.
      </p>
      {resource.loading && <p role="status">Buscando recebimentos…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.data && (
        <PaymentHistory
          payments={resource.data.items}
          restaurantId={restaurantId}
          range={range}
          onChanged={() => void resource.reload()}
          disabled={resource.loading || !!resource.error}
        />
      )}
      <nav className="orders-pagination" aria-label="Páginas de recebimentos">
        <button
          type="button"
          className="secondary-button"
          disabled={cursors.length === 1 || resource.loading}
          onClick={() => setCursors((v) => v.slice(0, -1))}
        >
          Mais recentes
        </button>
        <span>Página {cursors.length}</span>
        <button
          type="button"
          className="secondary-button"
          disabled={!resource.data?.nextCursor || resource.loading || !!resource.error}
          onClick={() => setCursors((v) => [...v, resource.data!.nextCursor!])}
        >
          Mais antigos
        </button>
      </nav>
      {creating && (
        <Dialog title="Recebimento avulso" onClose={() => setCreating(false)}>
          <PaymentForm
            restaurantId={restaurantId}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false)
              void resource.reload()
            }}
          />
        </Dialog>
      )}
    </section>
  )
}
