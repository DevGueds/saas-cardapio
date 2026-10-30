import { z } from "zod"

export const emailVerificationSchema = z.strictObject({
  email: z.email(),
  verified: z.boolean(),
  required: z.boolean(),
  deadline: z.iso.datetime(),
  retryAt: z.iso.datetime().nullable().optional(),
})
export type EmailVerificationView = z.infer<typeof emailVerificationSchema>
export const emailCodeSchema = z.strictObject({
  code: z.string().regex(/^\d{6}$/, "Informe os 6 números enviados para seu e-mail."),
})
export const emailDeliverySchema = z.strictObject({
  sent: z.boolean(),
  retryAt: z.iso.datetime(),
})
