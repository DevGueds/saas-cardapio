import { describe, expect, it } from "vitest"
import {
  defaultStoreHours,
  effectiveStoreOpen,
  localClock,
  nextScheduledChange,
  parseStoreHours,
  scheduledOpen,
  validCalendarDate,
  zonedInstant,
} from "@cardapio/domain/store-hours"
import { analyticsWindow, comparisonPercent } from "@cardapio/domain/analytics"
import { hoursInputSchema } from "@cardapio/contracts"
import { validateCheckout } from "@cardapio/domain/checkout"
import { sampleMenu } from "./helpers"
const at = (date: string, time: string, zone = "America/Sao_Paulo") =>
  zonedInstant(date, time, zone)
const overnight = () =>
  parseStoreHours({
    ...defaultStoreHours(),
    enabled: true,
    weekly: [[], [{ opensAt: "18:00", closesAt: "02:00" }], [], [], [], [], []],
  })
const allDay = () =>
  parseStoreHours({
    ...defaultStoreHours(),
    enabled: true,
    weekly: Array.from({ length: 7 }, () => [{ opensAt: "00:00", closesAt: "24:00" }]),
  })
describe("automatic store hours", () => {
  it("rechecks the schedule at checkout even when the loaded open flag is stale", () => {
    const menu = sampleMenu(),
      product = menu.products[0]!
    expect(() =>
      validateCheckout(
        { ...menu, restaurant: { ...menu.restaurant, isOpen: true, hours: overnight() } },
        menu.restaurant.id,
        menu.revision,
        {
          restaurantId: menu.restaurant.id,
          lines: [
            { productId: product.id, quantity: 1, unitPrice: product.price, note: "" },
          ],
        },
        {
          name: "Cliente",
          phone: "11999990001",
          address: "Rua Teste, 10",
          notes: "",
          payment: "Pix",
          cashChange: "",
        },
        { now: at("2026-10-27", "02:00"), requireWhatsapp: false },
      ),
    ).toThrow(/fechada/)
  })
  it("opens at the inclusive boundary and closes at the exclusive overnight boundary", () => {
    const hours = overnight()
    expect(scheduledOpen(hours, at("2026-10-26", "17:59"))).toBe(false)
    for (const [date, time] of [
      ["2026-10-26", "18:00"],
      ["2026-10-26", "23:59"],
      ["2026-10-27", "01:59"],
    ])
      expect(scheduledOpen(hours, at(date!, time!))).toBe(true)
    expect(scheduledOpen(hours, at("2026-10-27", "02:00"))).toBe(false)
    expect(nextScheduledChange(hours, at("2026-10-26", "23:00"))).toBe(
      at("2026-10-27", "02:00"),
    )
  })
  it("a closed dated exception cuts the previous day's overnight shift at midnight", () => {
    const hours = parseStoreHours({
      ...overnight(),
      exceptions: [
        { date: "2026-10-27", label: "Feriado", yearly: false, intervals: [] },
      ],
    })
    expect(scheduledOpen(hours, at("2026-10-27", "01:00"))).toBe(false)
    expect(nextScheduledChange(hours, at("2026-10-26", "23:00"))).toBe(
      at("2026-10-27", "00:00"),
    )
  })
  it("annual holidays repeat and a specific date wins over the annual rule", () => {
    const hours = parseStoreHours({
      ...allDay(),
      exceptions: [
        { date: "2026-12-25", label: "Natal", yearly: true, intervals: [] },
        {
          date: "2027-12-25",
          label: "Evento",
          yearly: false,
          intervals: [{ opensAt: "10:00", closesAt: "12:00" }],
        },
      ],
    })
    expect(scheduledOpen(hours, at("2026-12-25", "11:00"))).toBe(false)
    expect(scheduledOpen(hours, at("2027-12-25", "11:00"))).toBe(true)
    expect(scheduledOpen(hours, at("2027-12-25", "12:00"))).toBe(false)
    expect(nextScheduledChange(hours, at("2026-10-26", "23:00"))).toBe(
      at("2026-12-25", "00:00"),
    )
  })
  it("supports split shifts and valid all-day operation", () => {
    const hours = parseStoreHours({
      ...defaultStoreHours(),
      enabled: true,
      weekly: Array.from({ length: 7 }, () => [
        { opensAt: "10:00", closesAt: "14:00" },
        { opensAt: "18:00", closesAt: "22:00" },
      ]),
    })
    expect(scheduledOpen(hours, at("2026-10-26", "14:00"))).toBe(false)
    expect(nextScheduledChange(hours, at("2026-10-26", "15:00"))).toBe(
      at("2026-10-26", "18:00"),
    )
    expect(nextScheduledChange(allDay(), at("2026-10-26", "15:00"))).toBeNull()
  })
  it("uses the store timezone and expires a manual override exactly on time", () => {
    const sp = overnight(),
      manaus = { ...sp, timeZone: "America/Manaus" },
      now = Date.parse("2026-10-26T21:30:00Z")
    expect(scheduledOpen(sp, now)).toBe(true)
    expect(scheduledOpen(manaus, now)).toBe(false)
    expect(localClock(now, manaus.timeZone).time).toBe("17:30")
    const hours = {
      ...allDay(),
      override: { isOpen: false, until: "2026-10-26T22:00:00Z" },
    }
    expect(
      effectiveStoreOpen({ isOpen: true, hours }, Date.parse(hours.override.until) - 1),
    ).toBe(false)
    expect(
      effectiveStoreOpen({ isOpen: false, hours }, Date.parse(hours.override.until)),
    ).toBe(true)
    expect(
      effectiveStoreOpen({ isOpen: true, hours: { ...hours, enabled: false } }, now),
    ).toBe(true)
  })
  it("rejects overlap, impossible dates, duplicate exceptions and untrusted override input", () => {
    expect(validCalendarDate("2026-99-99")).toBe(false)
    expect(validCalendarDate("2026-02-29")).toBe(false)
    expect(validCalendarDate("2028-02-29")).toBe(true)
    expect(() =>
      parseStoreHours({
        ...allDay(),
        weekly: [
          [
            { opensAt: "12:00", closesAt: "18:00" },
            { opensAt: "17:00", closesAt: "20:00" },
          ],
          [],
          [],
          [],
          [],
          [],
          [],
        ],
      }),
    ).toThrow(/sobrepor/)
    const exception = { date: "2026-12-25", label: "Natal", yearly: true, intervals: [] }
    expect(() =>
      parseStoreHours({
        ...allDay(),
        exceptions: [exception, { ...exception, date: "2027-12-25" }],
      }),
    ).toThrow(/repetidas/)
    const { override: _override, ...input } = allDay()
    expect(
      hoursInputSchema.safeParse({
        ...input,
        override: { isOpen: true, until: "2100-01-01T00:00:00Z" },
      }).success,
    ).toBe(false)
  })
})
describe("analytics calendar and comparison", () => {
  it("uses local midnight and compares the same elapsed time for today's partial period", () => {
    const window = analyticsWindow(
      "DAY",
      "2026-10-29",
      "America/Sao_Paulo",
      Date.parse("2026-10-29T15:00:00Z"),
    )
    expect(window.from).toBe("2026-10-29T03:00:00.000Z")
    expect(window.to).toBe("2026-10-29T15:00:00.000Z")
    expect(window.previousTo).toBe("2026-10-28T15:00:00.000Z")
    expect(window.buckets).toHaveLength(24)
    expect(window.partial).toBe(true)
  })
  it("handles Monday-based weeks, month lengths, leap years and future windows", () => {
    const now = Date.parse("2026-10-29T15:00:00Z")
    expect(analyticsWindow("WEEK", "2026-10-29", "UTC", now).from).toBe(
      "2026-10-26T00:00:00.000Z",
    )
    expect(analyticsWindow("MONTH", "2024-02-10", "UTC", now).buckets).toHaveLength(29)
    expect(analyticsWindow("YEAR", "2024-02-10", "UTC", now).buckets).toHaveLength(12)
    const future = analyticsWindow("DAY", "2026-11-10", "UTC", now)
    expect(future.from).toBe(future.to)
    expect(future.previousFrom).toBe(future.previousTo)
    expect(future.future).toBe(true)
    expect(comparisonPercent(100, 0)).toBeNull()
    expect(comparisonPercent(0, 0)).toBe(0)
    expect(comparisonPercent(150, 100)).toBe(50)
  })
})
