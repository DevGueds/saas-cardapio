import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react"
import {
  addCalendarDays,
  localClock,
  validCalendarDate,
  type HoursInput,
} from "@cardapio/domain/store-hours"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
export default function HoursCalendar({
  schedule,
  onChoose,
  disabled,
}: {
  schedule: HoursInput
  onChoose(date: string): void
  disabled: boolean
}) {
  const [month, setMonth] = useState(() =>
    localClock(Date.now(), schedule.timeZone).date.slice(0, 7),
  )
  const root = useRef<HTMLDivElement>(null)
  const first = month + "-01",
    firstWeekday = new Date(first + "T00:00:00Z").getUTCDay()
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(first + "T00:00:00Z"))
  const move = (offset: number) => {
    const value = new Date(first + "T00:00:00Z")
    value.setUTCMonth(value.getUTCMonth() + offset)
    setMonth(value.toISOString().slice(0, 7))
  }
  return (
    <section className="hours-calendar" aria-labelledby="hours-calendar-title">
      <div className="hours-section-heading">
        <div>
          <h2 id="hours-calendar-title">Feriados e exceções</h2>
          <p>Clique em uma data para fechar a loja ou usar um horário especial.</p>
        </div>
        <div className="calendar-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Mês anterior"
            disabled={month <= "2000-01"}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <label className="field">
            <span>Mês do calendário</span>
            <ValidatedInput
              type="month"
              min="2000-01"
              max="2100-12"
              value={month}
              onChange={(event) => {
                if (validCalendarDate(event.target.value + "-01"))
                  setMonth(event.target.value)
              }}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Próximo mês"
            disabled={month >= "2100-12"}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <p className="calendar-month-title" aria-live="polite">
        {monthLabel}
      </p>
      <div className="hours-calendar-grid" ref={root}>
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <span className="calendar-weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, "0")}`
          const exception =
            schedule.exceptions.find((e) => !e.yearly && e.date === date) ??
            schedule.exceptions.find((e) => e.yearly && e.date.slice(5) === date.slice(5))
          const intervals =
            exception?.intervals ?? schedule.weekly[(firstWeekday + index) % 7] ?? []
          const title = `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
          const details = `${title}: ${exception?.label ? exception.label + ". " : ""}${
            intervals.length
              ? intervals.map((i) => `${i.opensAt} até ${i.closesAt}`).join(", ")
              : "Sem faixas de abertura nesta data"
          }`
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              className={`calendar-day ${exception ? "is-exception" : ""} ${date === localClock(Date.now(), schedule.timeZone).date ? "is-today" : ""}`}
              disabled={disabled}
              aria-label={`Editar horário de ${title}${exception ? `: ${exception.label || "exceção"}` : ""}`}
              aria-description={details}
              title={details}
              onClick={() => onChoose(date)}
              onKeyDown={(event) => {
                const offset = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                }[event.key]
                if (!offset) return
                event.preventDefault()
                const next = addCalendarDays(date, offset)
                if (!validCalendarDate(next)) return
                setMonth(next.slice(0, 7))
                window.requestAnimationFrame(() =>
                  root.current
                    ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
                    ?.focus(),
                )
              }}
            >
              <strong>{index + 1}</strong>
              <span className="calendar-day__label">
                {exception?.label || (intervals.length ? "Aberto" : "Fechado")}
              </span>
              <span className="calendar-day__compact" aria-hidden="true">
                {!intervals.length
                  ? "—"
                  : intervals.length === 1 &&
                      intervals[0]?.opensAt === "00:00" &&
                      intervals[0]?.closesAt === "24:00"
                    ? "24h"
                    : "Ab."}
              </span>
              <small>
                {intervals[0]
                  ? `${intervals[0].opensAt}–${intervals[0].closesAt}`
                  : "Sem atendimento"}
              </small>
              {exception?.yearly && <Repeat size={12} aria-label="Repete todo ano" />}
            </button>
          )
        })}
      </div>
      <p className="hours-help">
        <span className="calendar-mobile-legend">
          Ab.: faixas de abertura · —: sem abertura. Toque na data para ver os
          detalhes.{" "}
        </span>
        As exceções em destaque substituem o dia inteiro. Uma data específica tem
        prioridade sobre um feriado anual.
      </p>
    </section>
  )
}
