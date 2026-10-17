import { z } from "zod"
import { errorCodes, type ErrorCode } from "@cardapio/domain/failure"
import { parseMenuDocument, type MenuDocument } from "@cardapio/domain/menu-document"

export const API_VERSION = "v1"
import { uuid, revision, cents } from "./common.js"
export { uuid, revision, cents } from "./common.js"
export * from "./commerce.js"
import { checkoutOptionsSchema, pricedLineSchema, fulfillmentSchema } from "./commerce.js"
import {
  labelField as name,
  personNameField,
  emailField as email,
  slugField as slug,
  passwordField,
  currentPasswordField,
  phoneField,
  optionalPhoneField,
  moneyField,
  textField,
  imageField,
  validationMessage,
} from "./fields.js"
export * from "./fields.js"
export const password = passwordField
export const loginSchema = z.strictObject({ email, password: currentPasswordField })
export const registrationSchema = z.strictObject({
  name: personNameField,
  email,
  password,
  restaurantName: name,
  slug,
})
export const accountRegistrationSchema = registrationSchema.pick({
  name: true,
  email: true,
  password: true,
})
export const tenantCreationSchema = z.strictObject({ name, restaurantName: name, slug })
export const restaurantCreationSchema = z.strictObject({ name, slug })
export const passwordChangeSchema = z.strictObject({
  currentPassword: currentPasswordField,
  newPassword: password,
})
export const roleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "STAFF",
  "CASHIER",
  "KITCHEN",
  "COURIER",
  "VIEWER",
])
export type Role = z.infer<typeof roleSchema>
export const sessionSchema = z.strictObject({
  user: z.strictObject({ id: uuid, name }),
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.iso.datetime(),
})
export type SessionView = z.infer<typeof sessionSchema>
export const restaurantAccessSchema = z.strictObject({
  id: uuid,
  tenantId: uuid,
  name,
  slug,
  role: roleSchema,
})
export type RestaurantAccess = z.infer<typeof restaurantAccessSchema>
export const memberSchema = z.strictObject({ email, role: roleSchema.exclude(["OWNER"]) })
export const moneyText = moneyField()
const image = imageField
export const productSchema = z.strictObject({
  name,
  description: textField(2000),
  price: moneyField(true),
  categoryId: z.string().max(100),
  newCategoryName: textField(80, true).optional(),
  imageUrl: image,
  available: z.boolean(),
  popular: z.boolean(),
})
export const saveProductSchema = productSchema.extend({ expectedRevision: revision })
export const availabilitySchema = z.strictObject({
  expectedRevision: revision,
  available: z.boolean(),
})
export const deleteSchema = z.strictObject({ expectedRevision: revision })
export const openSchema = z.strictObject({
  expectedRevision: revision,
  isOpen: z.boolean(),
})
export const settingsSchema = z.strictObject({
  name,
  description: textField(1000),
  whatsapp: optionalPhoneField,
  address: textField(500),
  logoUrl: image,
  coverUrl: image,
  deliveryFee: moneyText,
  minOrder: moneyText,
  eta: textField(80, true),
})
export const updateSettingsSchema = settingsSchema.extend({ expectedRevision: revision })
export const cartSchema = z.strictObject({
  restaurantId: uuid,
  lines: z
    .array(
      z.strictObject({
        productId: uuid,
        quantity: z.number().int().min(1).max(999),
        unitPrice: cents.positive(),
        note: textField(500),
        kind: z.enum(["PRODUCT", "COMBO"]).optional(),
        selections: z
          .record(uuid, uuid)
          .refine((v) => Object.keys(v).length <= 8)
          .optional(),
      }),
    )
    .min(1)
    .max(100),
})
export const deliverySchema = z.strictObject({
  name,
  phone: z.string().max(30),
  address: z.string().trim().max(500),
  notes: z.string().max(500),
  payment: z.enum(["Pix", "Cartão na Entrega", "Dinheiro"]),
  cashChange: z.string().max(30),
})
export const deliveryInputSchema = deliverySchema
  .extend({
    name: personNameField,
    phone: phoneField,
    address: textField(500),
    notes: textField(500),
    cashChange: textField(30),
  })
  .superRefine((v, ctx) => {
    if (v.payment !== "Dinheiro") return
    const amount = moneyField(true, true).safeParse(v.cashChange)
    if (!amount.success)
      ctx.addIssue({
        code: "custom",
        path: ["cashChange"],
        message: validationMessage(amount.error.issues[0]!),
      })
  })
  .transform((v) => ({ ...v, cashChange: v.payment === "Dinheiro" ? v.cashChange : "" }))
export const checkoutSchema = z
  .strictObject({
    expectedRevision: revision,
    cart: cartSchema,
    details: deliveryInputSchema,
    options: checkoutOptionsSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.options?.fulfillment?.mode !== "PICKUP" && !value.details.address.trim())
      context.addIssue({
        code: "custom",
        path: ["details", "address"],
        message: "Informe rua, número, bairro e complemento para a entrega.",
      })
  })
export type CheckoutInput = z.infer<typeof checkoutSchema>
export const orderStatusSchema = z.enum([
  "NEW",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
])
export type OrderStatus = z.infer<typeof orderStatusSchema>
export const orderTransitionSchema = z.strictObject({
  expectedRevision: revision,
  status: orderStatusSchema,
})
export const orderSchema = z.strictObject({
  id: uuid,
  restaurantId: uuid,
  revision,
  status: orderStatusSchema,
  createdAt: z.iso.datetime(),
  customer: deliverySchema,
  subtotal: cents,
  deliveryFee: cents,
  total: cents,
  items: z.array(pricedLineSchema),
  discount: cents.optional(),
  promotionName: z.string().max(120).nullable().optional(),
  promotionId: uuid.nullable().optional(),
  fulfillment: fulfillmentSchema.optional(),
  region: z.string().max(300).optional(),
  eta: z.string().max(80).optional(),
  courierId: uuid.nullable().optional(),
  history: z
    .array(z.strictObject({ status: orderStatusSchema, at: z.iso.datetime() }))
    .max(20)
    .optional(),
})
export type OrderView = z.infer<typeof orderSchema>
export const orderPageSchema = z.strictObject({
  items: z.array(orderSchema),
  nextCursor: uuid.nullable(),
})
export const preparedOrderSchema = z.strictObject({
  url: z.union([z.url(), z.literal("")]),
  revision,
  orderId: uuid.optional(),
  trackingToken: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
})
export type PreparedOrderView = z.infer<typeof preparedOrderSchema>
export const errorSchema = z.strictObject({
  code: z.enum(errorCodes),
  message: z.string(),
  fields: z.record(z.string(), z.string()),
  diagnosticId: z.string(),
})
export type AppError = {
  code: ErrorCode
  message: string
  fields: Readonly<Record<string, string>>
  diagnosticId: string
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
export function decodeMenu(value: unknown): MenuDocument {
  const identity = z.object({ restaurant: z.object({ id: z.string() }) }).parse(value)
  return parseMenuDocument(value, identity.restaurant.id)
}
export const menuSchema = z.unknown().transform((value, context) => {
  try {
    return decodeMenu(value)
  } catch {
    context.addIssue({ code: "custom", message: "Cardápio inválido." })
    return z.NEVER
  }
})

export const quoteRequestSchema = z.strictObject({
  expectedRevision: revision,
  cart: cartSchema,
  options: checkoutOptionsSchema.optional(),
})
export const assignmentSchema = z.strictObject({
  expectedRevision: revision,
  courierId: uuid.nullable(),
})
export const trackingSchema = orderSchema
  .omit({ customer: true, courierId: true, promotionId: true })
  .extend({ restaurantName: z.string().max(120) })
export type TrackingView = z.infer<typeof trackingSchema>
export const teamMemberSchema = z.strictObject({
  userId: uuid,
  name: z.string().max(120),
  role: roleSchema,
})
