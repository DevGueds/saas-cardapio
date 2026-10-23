import { z } from "zod"
import { uuid } from "./common.js"
import { currentPasswordField } from "./fields.js"
export const mfaCodeSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\d{6}|[a-fA-F0-9]{24})$/,
    "Informe os 6 dígitos do aplicativo ou um código de recuperação de 24 caracteres.",
  )
export const mfaProofSchema = z.strictObject({ code: mfaCodeSchema })
export const reauthenticationSchema = z.strictObject({
  currentPassword: currentPasswordField,
})
export const mfaDisableSchema = reauthenticationSchema.extend({ code: mfaCodeSchema })
export const mfaSetupSchema = z.strictObject({
  secret: z.string().min(32).max(128),
  qr: z.string().startsWith("data:image/png;base64,"),
  expiresAt: z.iso.datetime(),
})
export const mfaStatusSchema = z.strictObject({
  enabled: z.boolean(),
  required: z.boolean(),
  recoveryRemaining: z.number().int().min(0).max(10),
})
export const mfaOverrideSchema = z.enum(["INHERIT", "REQUIRED", "EXEMPT"])
export const securityPolicySchema = z.strictObject({
  required: z.boolean(),
  members: z.array(
    z.strictObject({
      userId: uuid,
      name: z.string(),
      role: z.string(),
      override: mfaOverrideSchema,
      enabled: z.boolean(),
    }),
  ),
})
export const securityPolicyChangeSchema = reauthenticationSchema.extend({
  required: z.boolean(),
})
export const securityMemberChangeSchema = reauthenticationSchema.extend({
  override: mfaOverrideSchema,
})
export type MfaStatus = z.infer<typeof mfaStatusSchema>
export type MfaSetup = z.infer<typeof mfaSetupSchema>
export type SecurityPolicy = z.infer<typeof securityPolicySchema>
export type MfaOverride = z.infer<typeof mfaOverrideSchema>
