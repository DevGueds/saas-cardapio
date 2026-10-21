import { z } from "zod"
import { addonSelectionsSchema } from "@cardapio/contracts"
const id = z.string().min(1).max(100)
export const cartDraftSchema = z.strictObject({
  restaurantId: id,
  lines: z
    .array(
      z.strictObject({
        productId: id,
        addons: addonSelectionsSchema.optional(),
        quantity: z.number().int().min(1).max(999),
        unitPrice: z.number().int().positive().max(2147483647),
        note: z.string().max(500),
        kind: z.enum(["PRODUCT", "COMBO"]).optional(),
        selections: z
          .record(id, id)
          .refine((v) => Object.keys(v).length <= 8)
          .optional(),
      }),
    )
    .max(100),
})
export const customerDraftSchema = z.strictObject({
  name: z.string().max(120),
  phone: z.string().max(30),
  address: z.string().max(500),
  notes: z.string().max(500),
  payment: z.enum(["Pix", "Cartão na Entrega", "Dinheiro"]),
  cashChange: z.string().max(30),
})
export const checkoutDraftSchema = z.strictObject({
  destination: z
    .strictObject({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullable()
    .default(null),
  destinationAddress: z.string().max(1000).default(""),
  whatsappConsent: z.boolean().default(false),
  details: customerDraftSchema,
  mode: z.enum(["DELIVERY", "PICKUP"]),
  zoneId: z.string().max(100),
  couponCode: z.string().max(30),
  cep: z.string().max(9),
})
