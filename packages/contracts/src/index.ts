import { z } from "zod"
import { errorCodes, type ErrorCode } from "@cardapio/domain/failure"
import { parseMenuDocument, type MenuDocument } from "@cardapio/domain/menu-document"

export const API_VERSION = "v1"
export const uuid = z.uuid()
export const revision = z.number().int().min(0).max(2_147_483_646)
export const cents = z.number().int().min(0).max(2_147_483_647)
const name = z.string().trim().min(1).max(120)
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(3)
  .max(80)
const email = z.email().trim().toLowerCase().max(254)
export const password = z
  .string()
  .refine((value) => Array.from(value).length >= 8, "Use pelo menos 8 caracteres.")
  .refine((value) => Array.from(value).length <= 128, "Use no máximo 128 caracteres.")
export const loginSchema = z.strictObject({ email, password: z.string().min(1).max(512) })
export const registrationSchema = z.strictObject({
  name,
  email,
  password,
  restaurantName: name,
  slug,
})
export const tenantCreationSchema = z.strictObject({ name, restaurantName: name, slug })
export const restaurantCreationSchema = z.strictObject({ name, slug })
export const passwordChangeSchema = z.strictObject({
  currentPassword: z.string().min(1).max(512),
  newPassword: password,
})
export const roleSchema = z.enum(["OWNER", "MANAGER", "STAFF"])
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
export const memberSchema = z.strictObject({ email, role: z.enum(["MANAGER", "STAFF"]) })
export const moneyText = z.string().max(20)
const image = z.string().max(7_000_000)
export const productSchema = z.strictObject({
  name,
  description: z.string().max(2000),
  price: moneyText,
  categoryId: z.string().max(100),
  newCategoryName: z.string().trim().min(1).max(80).optional(),
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
  description: z.string().max(1000),
  whatsapp: z.string().max(30),
  address: z.string().max(500),
  logoUrl: image,
  coverUrl: image,
  deliveryFee: moneyText,
  minOrder: moneyText,
  eta: z.string().trim().min(1).max(80),
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
        note: z.string().max(500),
      }),
    )
    .min(1)
    .max(100),
})
export const deliverySchema = z.strictObject({
  name,
  phone: z.string().max(30),
  address: z.string().trim().min(1).max(500),
  notes: z.string().max(500),
  payment: z.enum(["Pix", "Cartão na Entrega", "Dinheiro"]),
  cashChange: z.string().max(30),
})
export const checkoutSchema = z.strictObject({
  expectedRevision: revision,
  cart: cartSchema,
  details: deliverySchema,
})
export type CheckoutInput = z.infer<typeof checkoutSchema>
export const orderStatusSchema = z.enum([
  "NEW",
  "PREPARING",
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
  items: z.array(
    z.strictObject({
      productId: uuid,
      name,
      quantity: z.number().int().positive(),
      unitPrice: cents,
      note: z.string().max(500),
    }),
  ),
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
