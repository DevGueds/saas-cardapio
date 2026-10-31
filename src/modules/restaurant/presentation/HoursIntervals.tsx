import { Plus, X } from "lucide-react"
import type { HoursInterval } from "@cardapio/domain/store-hours"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
export default function HoursIntervals({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: readonly HoursInterval[]
  onChange(value: HoursInterval[]): void
  label: string
  disabled?: boolean
}) {
  const allDay =
    value.length === 1 && value[0]?.opensAt === "00:00" && value[0]?.closesAt === "24:00"
  return (
    <div className="hours-intervals">
      {value.length === 0 && <span className="hours-closed-label">Fechado</span>}
      {allDay ? (
        <strong className="hours-all-day">
          Aberto 24 horas
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            Remover
          </button>
        </strong>
      ) : (
        value.map((interval, index) => (
          <div className="hours-interval" key={index}>
            <label className="field">
              <span>Abertura</span>
              <ValidatedInput
                type="time"
                required
                value={interval.opensAt}
                aria-label={`Abertura ${label}, faixa ${index + 1}`}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((v, i) =>
                      i === index ? { ...v, opensAt: event.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <span className="hours-interval__separator">até</span>
            <label className="field">
              <span>Fechamento</span>
              <ValidatedInput
                type="time"
                required
                value={interval.closesAt === "24:00" ? "00:00" : interval.closesAt}
                aria-label={`Fechamento ${label}, faixa ${index + 1}`}
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    value.map((v, i) =>
                      i === index ? { ...v, closesAt: event.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover faixa ${index + 1} de ${label}`}
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <X size={17} aria-hidden="true" />
            </button>
            {interval.closesAt && interval.closesAt < interval.opensAt && (
              <small className="hours-overnight">Fecha no dia seguinte</small>
            )}
          </div>
        ))
      )}
      <div className="hours-intervals__actions">
        {!allDay && value.length < 4 && (
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...value,
                {
                  opensAt: value.length ? "" : "18:00",
                  closesAt: value.length ? "" : "23:00",
                },
              ])
            }
          >
            <Plus size={15} aria-hidden="true" />
            Adicionar horário
          </button>
        )}
        {value.length === 0 && (
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => onChange([{ opensAt: "00:00", closesAt: "24:00" }])}
          >
            24 horas
          </button>
        )}
      </div>
    </div>
  )
}
