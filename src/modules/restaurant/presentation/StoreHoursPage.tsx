import { useState, type FormEvent } from "react"
import { CalendarClock, Clock3, Save } from "lucide-react"
import { hoursInputSchema } from "@cardapio/contracts"
import { can } from "@cardapio/domain/permissions"
import {
  defaultStoreHours,
  localClock,
  storeAvailability,
  weekDayNames,
  type HoursException,
  type HoursInput,
} from "@cardapio/domain/store-hours"
import { useMenu } from "../../../app/presentation/MenuScope"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useFormDraft } from "../../../app/presentation/use-form-draft"
import { useAccount } from "../../identity/presentation/AccountContext"
import PageHeading from "../../../shared/presentation/PageHeading"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import ValidatedInput from "../../../shared/presentation/form-validation/ValidatedInput"
import ValidatedSelect from "../../../shared/presentation/form-validation/ValidatedSelect"
import DraftNotice from "../../../shared/presentation/DraftNotice"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { hoursDraftSchema } from "../application/hours-draft"
import HoursIntervals from "./HoursIntervals"
import HoursCalendar from "./HoursCalendar"
import HoursExceptionDialog from "./HoursExceptionDialog"
const timeZones = [
  ["America/Sao_Paulo", "Brasília · São Paulo"],
  ["America/Fortaleza", "Fortaleza"],
  ["America/Recife", "Recife"],
  ["America/Bahia", "Bahia"],
  ["America/Belem", "Belém"],
  ["America/Manaus", "Manaus"],
  ["America/Boa_Vista", "Boa Vista"],
  ["America/Cuiaba", "Cuiabá"],
  ["America/Campo_Grande", "Campo Grande"],
  ["America/Porto_Velho", "Porto Velho"],
  ["America/Rio_Branco", "Rio Branco"],
  ["America/Noronha", "Fernando de Noronha"],
]
const editable = (hours = defaultStoreHours()): HoursInput => {
  const { override: _override, ...input } = hours
  return input
}
const exceptionKey = (value: HoursException) =>
  value.yearly ? "annual:" + value.date.slice(5) : value.date
export default function StoreHoursPage() {
  const { menu, loading, error, reload } = useMenu(),
    { restaurant: service } = useServices(),
    account = useAccount()
  const mutation = useMutation(),
    [formError, setFormError] = useState<string | null>(null),
    [selectedDate, setSelectedDate] = useState<string | null>(null)
  const draft = useFormDraft(
    "store-hours",
    hoursDraftSchema.parse({
      revision: menu.revision,
      schedule: editable(menu.restaurant.hours),
    }),
    hoursDraftSchema.parse,
  )
  const schedule = draft.value.schedule
  const readOnly = !!account && !can(account.restaurant.role, "catalog:write"),
    blocked = loading || !!error || mutation.pending || readOnly
  const availability = storeAvailability(menu.restaurant),
    zone = menu.restaurant.hours?.timeZone ?? "America/Sao_Paulo"
  const existing = selectedDate
    ? (schedule.exceptions.find((e) => !e.yearly && e.date === selectedDate) ??
      schedule.exceptions.find(
        (e) => e.yearly && e.date.slice(5) === selectedDate.slice(5),
      ))
    : undefined
  function change(next: HoursInput) {
    setFormError(null)
    draft.set({
      revision: draft.value.revision,
      schedule: hoursDraftSchema.shape.schedule.parse(next),
    })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!service.hours || blocked) return
    const valid = hoursInputSchema.safeParse(schedule)
    if (!valid.success) {
      setFormError(valid.error.issues[0]?.message ?? "Revise a programação.")
      return
    }
    const result = await mutation.run(
      () => service.hours!(menu.restaurant.id, draft.value.revision, valid.data),
      "Programação salva e aplicada à loja.",
    )
    if (result?.ok) {
      draft.reset(
        hoursDraftSchema.parse({
          revision: result.value.revision,
          schedule: editable(result.value.restaurant.hours),
        }),
      )
      await reload()
    }
  }
  async function resume() {
    if (!service.hours || blocked) return
    const result = await mutation.run(
      () =>
        service.hours!(
          menu.restaurant.id,
          menu.revision,
          editable(menu.restaurant.hours),
        ),
      "A loja voltou à programação automática.",
    )
    if (result?.ok) {
      draft.reset(
        hoursDraftSchema.parse({
          revision: result.value.revision,
          schedule: editable(result.value.restaurant.hours),
        }),
      )
      await reload()
    }
  }
  return (
    <div className="store-hours-page">
      <PageHeading
        eyebrow="Sua operação, no horário certo"
        title="Horários da loja"
        description="Configure uma semana padrão e ajuste feriados ou datas especiais. A loja abre e fecha automaticamente, mesmo com o painel fechado."
      />
      <section className="hours-status-card" aria-label="Situação dos horários">
        <CalendarClock size={28} aria-hidden="true" />
        <div>
          <strong>
            {menu.restaurant.isOpen ? "Loja aberta agora" : "Loja fechada agora"}
          </strong>
          <p>
            {availability.mode === "MANUAL"
              ? "Controle manual: ative a programação para automatizar."
              : availability.mode === "OVERRIDE"
                ? `Controle manual até ${new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "short", timeStyle: "short" }).format(new Date(availability.overrideUntil!))}. Depois, os horários voltam a valer.`
                : "Seguindo os horários automáticos."}
          </p>
          {availability.nextChangeAt && (
            <small>
              Próxima mudança prevista:{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                timeZone: zone,
                dateStyle: "short",
                timeStyle: "short",
              }).format(availability.nextChangeAt)}
            </small>
          )}
        </div>
        {availability.mode === "OVERRIDE" && (
          <button
            type="button"
            className="secondary-button"
            disabled={blocked || draft.saved}
            onClick={() => void resume()}
          >
            Voltar à programação
          </button>
        )}
      </section>
      {!service.hours && (
        <p className="info-notice">
          A configuração de horários não está disponível nesta instalação.
        </p>
      )}
      {readOnly && (
        <p className="info-notice">
          Somente o proprietário ou gerente pode alterar os horários.
        </p>
      )}
      <DraftNotice draft={draft} />
      <ValidatedForm className="hours-form" onSubmit={submit}>
        <fieldset disabled={blocked || !service.hours} className="hours-settings-card">
          <legend className="sr-only">Programação de funcionamento</legend>
          <div className="hours-section-heading">
            <div>
              <h2>
                <Clock3 size={21} aria-hidden="true" />
                Horários automáticos
              </h2>
              <p>Ao salvar, a programação passa a valer imediatamente.</p>
            </div>
            <label className="check-field">
              <ValidatedInput
                type="checkbox"
                checked={schedule.enabled}
                onChange={(event) =>
                  change({ ...schedule, enabled: event.target.checked })
                }
              />
              <span>Ativar horários automáticos</span>
            </label>
          </div>
          <label className="field hours-timezone">
            <span>Fuso horário da loja *</span>
            <ValidatedSelect
              value={schedule.timeZone}
              required
              onChange={(event) => change({ ...schedule, timeZone: event.target.value })}
            >
              {!timeZones.some(([value]) => value === schedule.timeZone) && (
                <option value={schedule.timeZone}>{schedule.timeZone}</option>
              )}
              {timeZones.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </ValidatedSelect>
            <small>
              Agora na loja:{" "}
              {localClock(Date.now(), schedule.timeZone)
                .date.split("-")
                .reverse()
                .join("/")}{" "}
              · {localClock(Date.now(), schedule.timeZone).time}
            </small>
          </label>
          <div className="hours-section-heading">
            <div>
              <h2>Semana padrão</h2>
              <p>Deixe sem faixa os dias em que a loja não atende.</p>
            </div>
          </div>
          <div className="hours-weekly">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <div className="hours-day-row" key={day}>
                <strong>{weekDayNames[day]}</strong>
                <HoursIntervals
                  label={weekDayNames[day]}
                  disabled={blocked}
                  value={schedule.weekly[day]!}
                  onChange={(intervals) =>
                    change({
                      ...schedule,
                      weekly: schedule.weekly.map((value, index) =>
                        index === day ? intervals : value,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="hours-copy-actions">
            <p>Configure a segunda-feira e copie para agilizar:</p>
            <button
              type="button"
              className="secondary-button"
              disabled={!schedule.weekly[1]?.length}
              onClick={() =>
                change({
                  ...schedule,
                  weekly: schedule.weekly.map((day, index) =>
                    index >= 1 && index <= 5 ? schedule.weekly[1]! : day,
                  ),
                })
              }
            >
              Repetir nos dias úteis
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!schedule.weekly[1]?.length}
              onClick={() =>
                change({
                  ...schedule,
                  weekly: schedule.weekly.map(() => schedule.weekly[1]!),
                })
              }
            >
              Repetir na semana inteira
            </button>
          </div>
          <p className="hours-help">
            Ex.: abrir às 18:00 e fechar às 02:00 mantém a loja aberta até a madrugada
            seguinte. Um feriado marcado como fechado interrompe o atendimento à
            meia-noite.
          </p>
        </fieldset>
        <HoursCalendar
          schedule={schedule}
          disabled={blocked || !service.hours}
          onChoose={setSelectedDate}
        />
        {formError && (
          <p className="error-notice" role="alert">
            {formError}
          </p>
        )}
        {mutation.error && (
          <ErrorNotice
            error={mutation.error}
            onRetry={async () => {
              const latest = await reload()
              if (latest) draft.set({ ...draft.value, revision: latest.revision })
            }}
          />
        )}
        <div className="hours-save-bar">
          <p>
            {schedule.enabled
              ? "A programação e as exceções serão aplicadas ao salvar."
              : "A programação está desativada. A loja seguirá o controle manual."}
          </p>
          <button className="primary-button" disabled={blocked || !service.hours}>
            <Save size={18} aria-hidden="true" />
            {mutation.pending ? "Salvando…" : "Salvar programação"}
          </button>
        </div>
      </ValidatedForm>
      {selectedDate && (
        <HoursExceptionDialog
          key={selectedDate}
          date={selectedDate}
          existing={existing}
          onClose={() => setSelectedDate(null)}
          onRemove={() => {
            change({
              ...schedule,
              exceptions: schedule.exceptions.filter(
                (e) => exceptionKey(e) !== exceptionKey(existing!),
              ),
            })
            setSelectedDate(null)
          }}
          onSave={(value) => {
            const next = {
              ...schedule,
              exceptions: [
                ...schedule.exceptions.filter(
                  (e) => !existing || exceptionKey(e) !== exceptionKey(existing),
                ),
                value,
              ],
            }
            const valid = hoursInputSchema.safeParse(next)
            if (!valid.success)
              return valid.error.issues[0]?.message ?? "Revise as exceções."
            change(next)
            setSelectedDate(null)
            return null
          }}
        />
      )}
    </div>
  )
}
