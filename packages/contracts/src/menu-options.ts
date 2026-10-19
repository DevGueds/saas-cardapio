import { z } from "zod"
import { uuid, revision, cents } from "./common.js"
import { textField } from "./fields.js"
export const addonSelectionsSchema = z
  .record(uuid, z.number().int().min(1).max(20))
  .refine((v) => Object.keys(v).length <= 60, "Selecione até 60 opções.")
export const addonGroupSchema = z
  .strictObject({
    id: uuid,
    name: textField(80, true),
    active: z.boolean(),
    min: z.number().int().min(0).max(20),
    max: z.number().int().min(1).max(20),
    productIds: z.array(uuid).max(500),
    options: z
      .array(
        z.strictObject({
          id: uuid,
          name: textField(80, true),
          price: cents,
          available: z.boolean(),
          maxQuantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine((v) => v.max >= v.min, {
    path: ["max"],
    message: "O máximo deve ser igual ou maior que o mínimo.",
  })
export const appearanceSchema = z.strictObject({
  preset: z.enum(["CLASSIC", "EDITORIAL", "COMPACT"]),
  color: z.enum(["ORANGE", "GREEN", "BLUE", "PLUM"]),
  showImages: z.boolean(),
  headline: textField(120),
})
export const saveAddonSchema = z.strictObject({
  expectedRevision: revision,
  group: addonGroupSchema,
})
export const saveAppearanceSchema = z.strictObject({
  expectedRevision: revision,
  appearance: appearanceSchema,
})
