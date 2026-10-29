import { addCalendarDays, validCalendarDate, zonedInstant } from "./store-hours.js"
import { requireValid } from "./failure.js"
export type AnalyticsPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR"
export function comparisonPercent(current: number, previous: number): number | null {
  return previous === 0
    ? current === 0
      ? 0
      : null
    : ((current - previous) / previous) * 100
}
export function analyticsWindow(
  period: AnalyticsPeriod,
  date: string,
  timeZone: string,
  now: number,
) {
  requireValid(validCalendarDate(date), "Escolha uma data válida.", "date")
  requireValid(
    ["DAY", "WEEK", "MONTH", "YEAR"].includes(period),
    "Escolha um período válido.",
  )
  let start = date
  if (period === "WEEK")
    start = addCalendarDays(date, -((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7))
  if (period === "MONTH") start = date.slice(0, 7) + "-01"
  if (period === "YEAR") start = date.slice(0, 4) + "-01-01"
  const shift = (source: string, amount: number) => {
    if (period === "DAY" || period === "WEEK")
      return addCalendarDays(source, amount * (period === "DAY" ? 1 : 7))
    const value = new Date(source + "T00:00:00Z")
    if (period === "MONTH") value.setUTCMonth(value.getUTCMonth() + amount)
    else value.setUTCFullYear(value.getUTCFullYear() + amount)
    return value.toISOString().slice(0, 10)
  }
  const end = shift(start, 1),
    previous = shift(start, -1)
  const from = zonedInstant(start, "00:00", timeZone),
    fullTo = zonedInstant(end, "00:00", timeZone)
  const previousFrom = zonedInstant(previous, "00:00", timeZone)
  const to = Math.max(from, Math.min(fullTo, now)),
    partial = to < fullTo
  const previousTo = partial ? Math.min(from, previousFrom + (to - from)) : from
  const buckets: { key: string; label: string; future: boolean }[] = []
  if (period === "DAY") {
    for (let hour = 0; hour < 24; hour++) {
      const time = String(hour).padStart(2, "0") + ":00"
      buckets.push({
        key: `${start}T${time}`,
        label: time,
        future: zonedInstant(start, time, timeZone) >= to,
      })
    }
  } else if (period === "YEAR") {
    for (let month = 1; month <= 12; month++) {
      const day = `${start.slice(0, 4)}-${String(month).padStart(2, "0")}-01`
      buckets.push({
        key: day + "T00:00",
        label: new Intl.DateTimeFormat("pt-BR", {
          month: "short",
          timeZone: "UTC",
        }).format(new Date(day + "T00:00:00Z")),
        future: zonedInstant(day, "00:00", timeZone) >= to,
      })
    }
  } else {
    for (let day = start; day < end; day = addCalendarDays(day, 1))
      buckets.push({
        key: day + "T00:00",
        label: `${day.slice(8)}/${day.slice(5, 7)}`,
        future: zonedInstant(day, "00:00", timeZone) >= to,
      })
  }
  return {
    period,
    date,
    timeZone,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    previousFrom: new Date(previousFrom).toISOString(),
    previousTo: new Date(previousTo).toISOString(),
    partial,
    future: from > now,
    buckets,
  }
}
export type AnalyticsWindow = ReturnType<typeof analyticsWindow>
