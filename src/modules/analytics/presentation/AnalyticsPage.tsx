import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import {
  ArrowUpRight,
  Bike,
  CalendarDays,
  ChartColumnIncreasing,
  Clock3,
  Download,
  RefreshCw,
  ShoppingBag,
  Ticket,
  Users,
  Wallet,
} from "lucide-react"
import type { AnalyticsQuery } from "@cardapio/contracts"
import { can } from "@cardapio/domain/permissions"
import { localClock, weekDayNames } from "@cardapio/domain/store-hours"
import { formatMoney } from "@cardapio/domain/money"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import PageHeading from "../../../shared/presentation/PageHeading"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import AnalyticsMetric from "./AnalyticsMetric"
import AnalyticsChart from "./AnalyticsChart"
import AnalyticsRankings from "./AnalyticsRankings"
const periods: [AnalyticsQuery["period"], string][] = [
  ["DAY", "Dia"],
  ["WEEK", "Semana"],
  ["MONTH", "Mês"],
  ["YEAR", "Ano"],
]
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })
const pct = (part: number, total: number) =>
  total ? `${number.format((part / total) * 100)}%` : "0%"
const minutes = (value: number | null) =>
  value === null ? "Sem dados" : `${number.format(value)} min`
export default function AnalyticsPage() {
  const { menu } = useMenu(),
    { analytics, files, mode } = useServices(),
    account = useAccount(),
    download = useMutation()
  const timeZone = menu.restaurant.hours?.timeZone ?? "America/Sao_Paulo"
  const [period, setPeriod] = useState<AnalyticsQuery["period"]>("WEEK"),
    [date, setDate] = useState(() => localClock(Date.now(), timeZone).date)
  const allowed = !!analytics && !!account && can(account.restaurant.role, "reports:read")
  const load = useCallback(
    () =>
      allowed
        ? analytics!.report(menu.restaurant.id, { period, date })
        : Promise.resolve({ ok: true as const, value: null }),
    [allowed, analytics, menu.restaurant.id, period, date],
  )
  const resource = useResource(load),
    report = resource.data
  const reloadAnalytics = resource.reload
  useEffect(() => {
    if (!allowed) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadAnalytics()
    }, 60000)
    return () => window.clearInterval(timer)
  }, [allowed, reloadAnalytics])
  const current = report?.current,
    previous = report?.previous
  const average = (sales: number, orders: number) =>
    orders ? Math.round(sales / orders) : 0
  return (
    <div className="analytics-page">
      <PageHeading
        eyebrow="Decisões melhores, todos os dias"
        title="Dashboard de desempenho"
        description="Entenda o que vende, quem volta e como sua operação evolui."
      >
        <button
          type="button"
          className="secondary-button"
          disabled={!allowed || resource.loading}
          onClick={() => void resource.reload()}
        >
          <RefreshCw size={17} aria-hidden="true" />
          Atualizar
        </button>
        {files && report && (
          <button
            type="button"
            className="secondary-button"
            disabled={resource.loading || !!resource.error || download.pending}
            onClick={() =>
              void download.run(
                () =>
                  files.json(
                    `pede-aqui-desempenho-${period.toLowerCase()}-${date}.json`,
                    report,
                  ),
                "Arquivo preparado. Confira os downloads do navegador.",
              )
            }
          >
            <Download size={17} aria-hidden="true" />
            Baixar dados
          </button>
        )}
      </PageHeading>
      {!allowed ? (
        <section className="analytics-connect">
          <ChartColumnIncreasing size={42} aria-hidden="true" />
          <h2>
            {mode === "demo"
              ? "Seu desempenho começa com pedidos reais"
              : "Acesso restrito à gestão"}
          </h2>
          <p>
            {mode === "demo"
              ? "Esta demonstração não contém vendas reais. Na loja conectada, o dashboard mostra pedidos concluídos, recompra, produtos, entregadores e comparações por período."
              : "O dashboard está disponível para o proprietário e os gerentes da loja."}
          </p>
          <Link
            to={mode === "demo" ? "/login" : "/admin/menu"}
            className="secondary-button"
          >
            {mode === "demo" ? "Acessar minha conta" : "Voltar ao cardápio"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <section className="analytics-filter-bar" aria-label="Período da análise">
            <div
              className="analytics-periods"
              role="group"
              aria-label="Agrupar desempenho por período"
            >
              {periods.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                Data de referência
              </span>
              <ValidatedInput
                type="date"
                value={date}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value)
                }}
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => setDate(localClock(Date.now(), timeZone).date)}
            >
              Hoje
            </button>
          </section>
          {resource.error && (
            <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
          )}{" "}
          {download.error && <ErrorNotice error={download.error} />}
          {resource.loading && (
            <p role="status" className="analytics-loading">
              Consultando os dados da loja…
            </p>
          )}
          {report && current && previous && (
            <>
              <div className="analytics-range-note">
                <span>
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: report.range.timeZone,
                    dateStyle: "medium",
                  }).format(new Date(report.range.from))}{" "}
                  · {periods.find(([value]) => value === period)?.[1]} ·{" "}
                  {report.range.timeZone}
                </span>
                <small>
                  {report.range.future
                    ? "Período futuro, ainda sem resultados."
                    : report.range.partial
                      ? "Comparação com o mesmo tempo decorrido no período anterior, limitada ao tamanho daquele período."
                      : "Comparação com o período anterior completo."}{" "}
                  Atualizado às{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: report.range.timeZone,
                    timeStyle: "short",
                  }).format(new Date(report.generatedAt))}
                  .
                </small>
              </div>
              <div className="analytics-metrics">
                <AnalyticsMetric
                  title="Vendas concluídas"
                  value={formatMoney(current.revenue)}
                  current={current.revenue}
                  previous={previous.revenue}
                  icon={<Wallet size={20} />}
                  help="Após descontos, incluindo taxas de entrega."
                />
                <AnalyticsMetric
                  title="Pedidos concluídos"
                  value={String(current.completed)}
                  current={current.completed}
                  previous={previous.completed}
                  icon={<ShoppingBag size={20} />}
                  help={`${current.inProgress} em andamento · ${current.orders} recebidos.`}
                />
                <AnalyticsMetric
                  title="Ticket médio"
                  value={formatMoney(average(current.revenue, current.completed))}
                  current={average(current.revenue, current.completed)}
                  previous={average(previous.revenue, previous.completed)}
                  icon={<Ticket size={20} />}
                  help="Valor médio de cada pedido concluído."
                />
                <AnalyticsMetric
                  title="Clientes compradores"
                  value={String(current.customers)}
                  current={current.customers}
                  previous={previous.customers}
                  icon={<Users size={20} />}
                  help={`${current.newCustomers} novos · ${current.returningCustomers} já compravam antes.`}
                />
              </div>
              {current.orders === 0 && (
                <p className="info-notice">
                  Nenhum pedido foi criado neste período. Escolha outra data ou acompanhe
                  os resultados após receber seus primeiros pedidos.
                </p>
              )}
              <AnalyticsChart series={report.series} />
              <div className="analytics-operational">
                <article>
                  <strong>{pct(current.cancelled, current.orders)}</strong>
                  <span>Taxa de cancelamento</span>
                  <small>
                    {current.cancelled} de {current.orders} pedidos recebidos
                  </small>
                </article>
                <article>
                  <strong>{pct(current.repeatCustomers, current.customers)}</strong>
                  <span>Clientes com recompra</span>
                  <small>
                    {current.repeatCustomers} compraram ao menos duas vezes no período
                  </small>
                </article>
                <article>
                  <Clock3 size={18} aria-hidden="true" />
                  <strong>{minutes(current.avgPreparationMinutes)}</strong>
                  <span>Tempo até ficar pronto ou sair</span>
                  <small>
                    {current.preparationSamples} pedidos com etapas registradas
                  </small>
                </article>
                <article>
                  <Bike size={18} aria-hidden="true" />
                  <strong>{minutes(current.avgDeliveryMinutes)}</strong>
                  <span>Tempo médio de entrega</span>
                  <small>
                    {current.deliverySamples} entregas com saída e conclusão registradas
                  </small>
                </article>
              </div>
              <AnalyticsRankings report={report} />
              <div className="analytics-insight-grid">
                <section className="analytics-panel">
                  <header>
                    <div>
                      <h2>Quando sua loja recebe pedidos</h2>
                      <p>Demanda sem cancelamentos, por horário e dia da semana.</p>
                    </div>
                  </header>
                  <div className="analytics-hour-heatmap">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const count =
                          report.busyHours.find((h) => h.hour === hour)?.orders ?? 0,
                        max = Math.max(1, ...report.busyHours.map((h) => h.orders))
                      return (
                        <div
                          key={hour}
                          title={`${hour}h: ${count} pedidos`}
                          style={{
                            backgroundColor: !count
                              ? "#f3f7f1"
                              : count / max >= 0.75
                                ? "#1f6349"
                                : count / max >= 0.5
                                  ? "#23785b"
                                  : "#d9e9cf",
                            color: count / max >= 0.5 ? "white" : "var(--forest)",
                          }}
                        >
                          <strong>{hour}h</strong>
                          <span>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                  <ol className="analytics-weekdays">
                    {report.weekdays.map((day) => (
                      <li key={day.day}>
                        <span>{weekDayNames[day.day]}</span>
                        <strong>{day.orders} pedidos</strong>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className="analytics-panel">
                  <header>
                    <div>
                      <h2>Como os clientes compram</h2>
                      <p>Informações dos pedidos concluídos no período.</p>
                    </div>
                  </header>
                  <dl className="analytics-summary-list">
                    <div>
                      <dt>Entregas</dt>
                      <dd>
                        {current.deliveries} ·{" "}
                        {pct(current.deliveries, current.completed)}
                      </dd>
                    </div>
                    <div>
                      <dt>Retiradas</dt>
                      <dd>
                        {current.pickups} · {pct(current.pickups, current.completed)}
                      </dd>
                    </div>
                    <div>
                      <dt>Valor bruto dos produtos</dt>
                      <dd>{formatMoney(current.itemsRevenue)}</dd>
                    </div>
                    <div>
                      <dt>Descontos concedidos</dt>
                      <dd>{formatMoney(current.discounts)}</dd>
                    </div>
                    <div>
                      <dt>Taxas de entrega</dt>
                      <dd>{formatMoney(current.deliveryFees)}</dd>
                    </div>
                  </dl>
                  <h3 className="analytics-small-title">
                    Forma de pagamento escolhida no pedido
                  </h3>
                  {report.paymentMethods.length ? (
                    <ul className="analytics-simple-list">
                      {report.paymentMethods.map((method) => (
                        <li key={method.name}>
                          <span>{method.name}</span>
                          <strong>{method.orders} pedidos</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="analytics-empty">
                      Sem pedidos concluídos neste período.
                    </p>
                  )}
                  <h3 className="analytics-small-title">Uso de promoções</h3>
                  {report.promotions.length ? (
                    <ul className="analytics-simple-list">
                      {report.promotions.map((p) => (
                        <li key={p.name}>
                          <span>
                            {p.name}
                            <small>{p.orders} pedidos</small>
                          </span>
                          <strong>{formatMoney(p.discounts)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="analytics-empty">
                      Nenhuma promoção usada em pedidos concluídos no período.
                    </p>
                  )}
                </section>
              </div>
              <footer className="analytics-definitions">
                <strong>Como ler estes números</strong>
                <p>
                  As vendas usam a data de criação dos pedidos que hoje estão concluídos.
                  Pedidos cancelados e em andamento ficam fora do faturamento e dos
                  rankings de compras. Clientes são identificados pelo telefone informado.
                  Os tempos consideram apenas etapas registradas em ordem cronológica.
                </p>
                <p>
                  Estes valores representam vendas, não recebimentos ou lucro. Confira o
                  caixa para acompanhar os pagamentos.
                </p>
              </footer>
            </>
          )}
        </>
      )}
    </div>
  )
}
