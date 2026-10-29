import { useState, type FormEvent } from "react"
import { hoursExceptionSchema } from "@cardapio/contracts"
import {
  parseStoreHours,
  defaultStoreHours,
  type HoursException,
  type HoursInterval,
} from "@cardapio/domain/store-hours"
import Dialog from "../../../shared/presentation/Dialog"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import HoursIntervals from "./HoursIntervals"
export default function HoursExceptionDialog({
  date,
  existing,
  onSave,
  onRemove,
  onClose,
}: {
  date: string
  existing?: HoursException
  onSave(value: HoursException): string | null
  onRemove(): void
  onClose(): void
}) {
  const [selectedDate, setSelectedDate] = useState(date),
    [label, setLabel] = useState(existing?.label ?? ""),
    [yearly, setYearly] = useState(existing?.yearly ?? false)
  const [closed, setClosed] = useState(!existing?.intervals.length),
    [intervals, setIntervals] = useState<readonly HoursInterval[]>(
      existing?.intervals.length
        ? existing.intervals
        : [{ opensAt: "18:00", closesAt: "23:00" }],
    )
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = hoursExceptionSchema.safeParse({
      date: selectedDate,
      label,
      yearly,
      intervals: closed ? [] : intervals,
    })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revise a exceção.")
      return
    }
    try {
      parseStoreHours({ ...defaultStoreHours(), exceptions: [result.data] })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Revise os horários.")
      return
    }
    setError(onSave(result.data))
  }
  return (
    <Dialog title="Horário especial" onClose={onClose}>
      <ValidatedForm className="editor-form" onSubmit={submit}>
        <p className="page-description">
          Esta regra vale para a data inteira e substitui a programação semanal.
        </p>
        <label className="field">
          <span>Data da exceção *</span>
          <ValidatedInput
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            value={selectedDate}
            schema={hoursExceptionSchema.shape.date}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Nome da exceção</span>
          <ValidatedInput
            placeholder="Ex.: Natal, manutenção, evento especial"
            maxLength={100}
            value={label}
            schema={hoursExceptionSchema.shape.label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label className="check-field">
          <ValidatedInput
            type="checkbox"
            checked={yearly}
            onChange={(event) => setYearly(event.target.checked)}
          />
          <span>Repetir todos os anos neste dia e mês</span>
        </label>
        <label className="check-field">
          <ValidatedInput
            type="checkbox"
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
          />
          <span>Loja fechada nesta data</span>
        </label>
        {!closed && (
          <HoursIntervals label="da exceção" value={intervals} onChange={setIntervals} />
        )}
        {error && (
          <p className="error-notice" role="alert">
            {error}
          </p>
        )}
        <p className="hours-help">
          Depois de adicionar, salve a programação para aplicar à loja.
        </p>
        <div className="form-actions">
          {existing && (
            <button className="text-button" type="button" onClick={onRemove}>
              Remover exceção
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            Adicionar à programação
          </button>
        </div>
      </ValidatedForm>
    </Dialog>
  )
}
