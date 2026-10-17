import { z } from "zod"
import { Failure } from "@cardapio/domain/failure"
const id = z.string().max(100),
  money = z.string().max(20)
export const comboDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  id,
  name: z.string().max(120),
  description: z.string().max(2000),
  price: money,
  active: z.boolean(),
  imageRemoved: z.boolean(),
  items: z
    .array(
      z.strictObject({
        productId: id,
        quantity: z
          .union([z.string().max(10), z.number().int().min(1).max(20)])
          .transform(String),
      }),
    )
    .max(20),
  groups: z
    .array(
      z.strictObject({
        id,
        name: z.string().max(80),
        options: z.array(z.strictObject({ productId: id, extraPrice: money })).max(20),
      }),
    )
    .max(8),
})
export const promotionDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  id,
  name: z.string().max(120),
  code: z.string().max(30),
  kind: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]),
  value: money,
  minSubtotal: money,
  maxDiscount: money,
  includeCombos: z.boolean(),
  active: z.boolean(),
  startsAt: z.string().max(30),
  endsAt: z.string().max(30),
  maxUses: z.string().max(10),
})
export function dateInput(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
export function isoDate(value: string) {
  const time = Date.parse(value)
  if (!Number.isFinite(time))
    throw new Failure("VALIDATION", "Preencha as datas de início e fim da promoção.")
  return new Date(time).toISOString()
}

export const comboSelectionsSchema = z
  .record(id, id)
  .refine((value) => Object.keys(value).length <= 8)
