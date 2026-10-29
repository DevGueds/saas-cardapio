import { requireValid } from "./failure.js"
import { record, text } from "./validation.js"

export type HoursInterval = Readonly<{ opensAt: string; closesAt: string }>
export type HoursException = Readonly<{
  date: string
  label: string
  yearly: boolean
  intervals: readonly HoursInterval[]
}>
export type StoreHours = Readonly<{
  enabled: boolean
  timeZone: string
  weekly: readonly (readonly HoursInterval[])[]
  exceptions: readonly HoursException[]
  override: Readonly<{ isOpen: boolean; until: string }> | null
}>
export type HoursInput = Omit<StoreHours, "override">
export const weekDayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const
export function defaultStoreHours(): StoreHours {
  return {
    enabled: false,
    timeZone: "America/Sao_Paulo",
    weekly: Array.from({ length: 7 }, () => []),
    exceptions: [],
    override: null,
  }
}
export function validCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    Number(value.slice(0, 4)) >= 2000 &&
    Number(value.slice(0, 4)) <= 2100 &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  )
}
export function addCalendarDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10)
}
const formatters = new Map<string, Intl.DateTimeFormat>()
export function localClock(now: number, timeZone: string) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    if (formatters.size >= 40) formatters.clear()
    formatters.set(timeZone, formatter)
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    second: Number(parts.second),
  }
}
export function zonedInstant(date: string, time: string, timeZone: string) {
  const target = Date.parse(`${date}T${time}:00Z`)
  let result = target
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = localClock(result, timeZone)
    const difference =
      target -
      Date.parse(`${local.date}T${local.time}:${String(local.second).padStart(2, "0")}Z`)
    if (!difference) break
    result += difference
  }
  return result
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
function parseIntervals(input: unknown): HoursInterval[] {
  requireValid(
    Array.isArray(input) && input.length <= 4,
    "Use até quatro faixas de horário por dia.",
    "weekly",
  )
  const intervals = input
    .map((value) => {
      const row = record(value)
      const opensAt = text(row.opensAt, "opensAt", 5, true),
        closesAt = text(row.closesAt, "closesAt", 5, true)
      requireValid(
        /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(opensAt) &&
          /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(closesAt),
        "Informe horários válidos.",
        "weekly",
      )
      requireValid(
        opensAt !== closesAt,
        "A abertura e o fechamento precisam ser diferentes. Para o dia inteiro, use 24 horas.",
        "weekly",
      )
      return { opensAt, closesAt }
    })
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
  for (let index = 1; index < intervals.length; index++) {
    const previous = intervals[index - 1]!,
      current = intervals[index]!
    const end =
      minutes(previous.closesAt) <= minutes(previous.opensAt)
        ? 1440
        : minutes(previous.closesAt)
    requireValid(
      minutes(current.opensAt) >= end,
      "As faixas do mesmo dia não podem se sobrepor.",
      "weekly",
    )
  }
  return intervals
}
export function parseStoreHours(input: unknown): StoreHours {
  const data = record(input)
  requireValid(
    typeof data.enabled === "boolean",
    "Informe se os horários automáticos estão ativos.",
  )
  const timeZone = text(data.timeZone, "timeZone", 100, true)
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone }).format(0)
  } catch {
    requireValid(false, "Escolha um fuso horário válido.", "timeZone")
  }
  requireValid(
    Array.isArray(data.weekly) && data.weekly.length === 7,
    "Configure os sete dias da semana.",
    "weekly",
  )
  const weekly = data.weekly.map(parseIntervals)
  requireValid(
    Array.isArray(data.exceptions) && data.exceptions.length <= 200,
    "Use até 200 exceções de calendário.",
    "exceptions",
  )
  const exceptions = data.exceptions.map((value) => {
    const row = record(value),
      date = text(row.date, "date", 10, true)
    requireValid(
      validCalendarDate(date),
      "Informe uma data válida entre 2000 e 2100.",
      "date",
    )
    requireValid(typeof row.yearly === "boolean", "Informe a repetição do feriado.")
    return {
      date,
      label: text(row.label, "label", 100),
      yearly: row.yearly,
      intervals: parseIntervals(row.intervals),
    }
  })
  const keys = exceptions.map((e) => (e.yearly ? `annual:${e.date.slice(5)}` : e.date))
  requireValid(
    new Set(keys).size === keys.length,
    "Há exceções repetidas para a mesma data.",
    "exceptions",
  )
  let override: StoreHours["override"] = null
  if (data.override !== undefined && data.override !== null) {
    const value = record(data.override)
    requireValid(
      typeof value.isOpen === "boolean" &&
        typeof value.until === "string" &&
        Number.isFinite(Date.parse(value.until)),
      "Controle manual inválido.",
    )
    override = { isOpen: value.isOpen, until: String(value.until) }
  }
  return { enabled: data.enabled, timeZone, weekly, exceptions, override }
}
function exceptionFor(hours: StoreHours, date: string) {
  return (
    hours.exceptions.find((e) => !e.yearly && e.date === date) ??
    hours.exceptions.find((e) => e.yearly && e.date.slice(5) === date.slice(5))
  )
}
function intervalsFor(hours: StoreHours, date: string) {
  return (
    exceptionFor(hours, date)?.intervals ??
    hours.weekly[new Date(date + "T00:00:00Z").getUTCDay()]!
  )
}
export function scheduledOpen(hours: StoreHours, now: number) {
  const local = localClock(now, hours.timeZone),
    minute = minutes(local.time)
  if (
    intervalsFor(hours, local.date).some(
      (i) =>
        minute >= minutes(i.opensAt) &&
        (minutes(i.closesAt) <= minutes(i.opensAt) || minute < minutes(i.closesAt)),
    )
  )
    return true
  // A dated exception controls the entire calendar day, including an overnight carry-over.
  if (exceptionFor(hours, local.date)) return false
  return intervalsFor(hours, addCalendarDays(local.date, -1)).some(
    (i) => minutes(i.closesAt) < minutes(i.opensAt) && minute < minutes(i.closesAt),
  )
}
export function nextScheduledChange(hours: StoreHours, now: number): number | null {
  const today = localClock(now, hours.timeZone).date,
    dates = new Set<string>()
  for (let day = 0; day <= 8; day++) dates.add(addCalendarDays(today, day))
  const year = Number(today.slice(0, 4))
  for (const exception of hours.exceptions) {
    const candidates = exception.yearly
      ? [year, year + 1, year + 2, year + 3, year + 4].map(
          (y) => `${y}-${exception.date.slice(5)}`,
        )
      : [exception.date]
    for (const date of candidates)
      if (validCalendarDate(date) && date >= today) {
        dates.add(date)
        dates.add(addCalendarDays(date, 1))
      }
  }
  const current = scheduledOpen(hours, now)
  for (const date of [...dates].sort()) {
    const candidates = [zonedInstant(date, "00:00", hours.timeZone)]
    for (const interval of intervalsFor(hours, date)) {
      candidates.push(zonedInstant(date, interval.opensAt, hours.timeZone))
      const tomorrow =
        minutes(interval.closesAt) <= minutes(interval.opensAt) ||
        interval.closesAt === "24:00"
      if (!tomorrow)
        candidates.push(zonedInstant(date, interval.closesAt, hours.timeZone))
    }
    // Closing times carried from yesterday also belong to today's timeline.
    for (const interval of intervalsFor(hours, addCalendarDays(date, -1)))
      if (minutes(interval.closesAt) < minutes(interval.opensAt))
        candidates.push(zonedInstant(date, interval.closesAt, hours.timeZone))
    for (const candidate of [...new Set(candidates)].sort((a, b) => a - b))
      if (candidate > now && scheduledOpen(hours, candidate) !== current) return candidate
  }
  return null
}
export function storeAvailability(
  restaurant: { isOpen: boolean; hours?: StoreHours },
  now = Date.now(),
) {
  const hours = restaurant.hours
  if (!hours?.enabled)
    return {
      isOpen: restaurant.isOpen,
      mode: "MANUAL" as const,
      nextChangeAt: null,
      overrideUntil: null,
    }
  const override =
    hours.override && Date.parse(hours.override.until) > now ? hours.override : null
  return {
    isOpen: override?.isOpen ?? scheduledOpen(hours, now),
    mode: override ? ("OVERRIDE" as const) : ("SCHEDULE" as const),
    nextChangeAt: override ? Date.parse(override.until) : nextScheduledChange(hours, now),
    overrideUntil: override?.until ?? null,
  }
}
export function effectiveStoreOpen(
  restaurant: { isOpen: boolean; hours?: StoreHours },
  now = Date.now(),
) {
  const hours = restaurant.hours
  if (!hours?.enabled) return restaurant.isOpen
  return hours.override && Date.parse(hours.override.until) > now
    ? hours.override.isOpen
    : scheduledOpen(hours, now)
}
