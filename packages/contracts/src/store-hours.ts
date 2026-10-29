import { z } from "zod"
import { parseStoreHours } from "@cardapio/domain/store-hours"
import { revision } from "./common.js"
import { textField } from "./fields.js"
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.")
export const hoursIntervalSchema = z.strictObject({
  opensAt: time,
  closesAt: z.union([time, z.literal("24:00")]),
})
export const hoursExceptionSchema = z.strictObject({
  date: z.iso.date(),
  label: textField(100),
  yearly: z.boolean(),
  intervals: z.array(hoursIntervalSchema).max(4),
})
export const hoursInputSchema = z
  .strictObject({
    enabled: z.boolean(),
    timeZone: z.string().min(1).max(100),
    weekly: z.array(z.array(hoursIntervalSchema).max(4)).length(7),
    exceptions: z.array(hoursExceptionSchema).max(200),
  })
  .superRefine((value, context) => {
    try {
      parseStoreHours({ ...value, override: null })
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Revise os horários.",
      })
    }
  })
export const updateHoursSchema = z.strictObject({
  expectedRevision: revision,
  schedule: hoursInputSchema,
})
