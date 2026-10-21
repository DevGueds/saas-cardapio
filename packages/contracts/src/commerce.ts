import { z } from "zod"
import { uuid, revision, cents } from "./common.js"
import {
  geoPointSchema,
  radiusDeliverySchema,
  radiusSnapshotSchema,
} from "./delivery-radius.js"
export * from "./delivery-radius.js"
import {
  labelField as name,
  textField,
  couponField,
  stateField,
  imageField,
} from "./fields.js"
export const comboSchema = z.strictObject({
  id: uuid,
  name,
  description: textField(2000),
  imageUrl: imageField,
  price: cents.positive(),
  active: z.boolean(),
  items: z
    .array(z.strictObject({ productId: uuid, quantity: z.number().int().min(1).max(20) }))
    .max(20),
  groups: z
    .array(
      z.strictObject({
        id: uuid,
        name: textField(80, true),
        options: z
          .array(z.strictObject({ productId: uuid, extraPrice: cents }))
          .min(1)
          .max(20),
      }),
    )
    .max(8),
})
export const promotionSchema = z
  .strictObject({
    id: uuid,
    name,
    code: couponField,
    kind: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]),
    value: cents,
    minSubtotal: cents,
    maxDiscount: cents,
    includeCombos: z.boolean(),
    active: z.boolean(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    maxUses: z.number().int().min(0).max(1_000_000),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.endsAt) <= Date.parse(v.startsAt))
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "O término deve ser posterior ao início da promoção.",
      })
    if (v.kind === "PERCENT" && (v.value < 1 || v.value > 100))
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Informe um desconto inteiro entre 1 e 100%.",
      })
    if (v.kind === "FIXED" && v.value <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "O desconto em reais deve ser maior que zero.",
      })
    if (v.kind === "FREE_DELIVERY" && v.value !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "A entrega grátis não recebe valor de desconto.",
      })
  })
export const zoneSchema = z
  .strictObject({
    id: uuid,
    state: stateField,
    city: name,
    neighborhood: name,
    fee: cents,
    etaMin: z.number().int().min(1).max(1440),
    etaMax: z.number().int().min(1).max(1440),
    active: z.boolean(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.etaMax < v.etaMin)
      ctx.addIssue({
        code: "custom",
        path: ["etaMax"],
        message: "O prazo máximo deve ser igual ou maior que o mínimo.",
      })
    if ((v.latitude === null) !== (v.longitude === null))
      ctx.addIssue({
        code: "custom",
        path: [v.latitude === null ? "latitude" : "longitude"],
        message: "Preencha latitude e longitude juntas, ou deixe ambas vazias.",
      })
  })
export const deliverySettingsSchema = z.strictObject({
  enabled: z.boolean(),
  pickupEnabled: z.boolean(),
  mode: z.enum(["FLAT", "ZONES", "RADIUS"]),
  pickupEta: textField(80, true),
  zones: z.array(zoneSchema).max(500),
  radius: radiusDeliverySchema.optional(),
})
export const saveComboSchema = z.strictObject({
  expectedRevision: revision,
  combo: comboSchema,
})
export const savePromotionSchema = z.strictObject({
  expectedRevision: revision,
  promotion: promotionSchema,
})
export const saveDeliverySchema = z.strictObject({
  expectedRevision: revision,
  delivery: deliverySettingsSchema,
})
export const fulfillmentSchema = z.strictObject({
  mode: z.enum(["DELIVERY", "PICKUP"]),
  zoneId: uuid.optional(),
  destination: geoPointSchema.optional(),
})
export const fulfillmentViewSchema = fulfillmentSchema.extend({
  radius: radiusSnapshotSchema.optional(),
})
export const checkoutOptionsSchema = z.strictObject({
  whatsappConsent: z.boolean().optional(),
  fulfillment: fulfillmentSchema.optional(),
  couponCode: couponField.optional(),
  expectedTotal: cents.optional(),
})
export const pricedLineSchema = z.strictObject({
  productId: uuid,
  name,
  quantity: z.number().int().min(1).max(999),
  unitPrice: cents.positive(),
  note: z.string().max(500),
  kind: z.enum(["PRODUCT", "COMBO"]).optional(),
  components: z.array(z.string().max(250)).max(60).optional(),
})
export const quoteSchema = z.strictObject({
  subtotal: cents,
  deliveryFee: cents,
  discount: cents,
  total: cents,
  promotionId: uuid.nullable(),
  promotionName: name.nullable(),
  eta: z.string().max(80),
  region: z.string().max(300),
  fulfillment: fulfillmentViewSchema,
  items: z.array(pricedLineSchema).min(1).max(100),
})
export const postalAddressSchema = z.strictObject({
  cep: z.string().regex(/^\d{8}$/),
  state: stateField,
  city: name,
  neighborhood: z.string().max(120),
  street: z.string().max(200),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})
export type PostalAddress = z.infer<typeof postalAddressSchema>
