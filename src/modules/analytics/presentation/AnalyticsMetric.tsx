import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { comparisonPercent } from "@cardapio/domain/analytics"
export default function AnalyticsMetric({
  title,
  value,
  current,
  previous,
  icon,
  help,
}: {
  title: string
  value: string
  current: number
  previous: number
  icon: ReactNode
  help: string
}) {
  const delta = comparisonPercent(current, previous)
  return (
    <article className="analytics-metric">
      <div className="analytics-metric__heading">
        <span>{title}</span>
        <i aria-hidden="true">{icon}</i>
      </div>
      <strong>{value}</strong>
      <div
        className={`analytics-delta ${delta !== null && delta > 0 ? "is-up" : delta !== null && delta < 0 ? "is-down" : ""}`}
      >
        {delta === null ? (
          <ArrowUpRight size={15} />
        ) : delta > 0 ? (
          <ArrowUpRight size={15} />
        ) : delta < 0 ? (
          <ArrowDownRight size={15} />
        ) : (
          <Minus size={15} />
        )}
        <span>
          {delta === null
            ? "Sem base no período anterior"
            : `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(delta)}% em relação ao anterior`}
        </span>
      </div>
      <small>{help}</small>
    </article>
  )
}
