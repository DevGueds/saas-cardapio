import { z } from "zod"
import { uuid } from "./common.js"
import { currentPasswordField, emailField, personNameField, textField } from "./fields.js"

export const LEGAL_VERSION = "2026-10-29.1"
export const privacyController = {
  brand: "Pede Aqui",
  legalName: "66.369.962 VITOR SOUSA MESQUITA",
  document: "66.369.962/0001-20",
  email: "pedeaqui99@gmail.com",
} as const
export const legalAcceptanceSchema = z.strictObject({
  accepted: z.literal(true, { error: "Leia e aceite os termos para criar sua conta." }),
  termsVersion: z.literal(LEGAL_VERSION),
  privacyVersion: z.literal(LEGAL_VERSION),
})
export type LegalAcceptance = z.infer<typeof legalAcceptanceSchema>
export const currentLegalAcceptance: LegalAcceptance = {
  accepted: true,
  termsVersion: LEGAL_VERSION,
  privacyVersion: LEGAL_VERSION,
}
export const privacyRequestKindSchema = z.enum([
  "ACCESS",
  "CORRECTION",
  "DELETION",
  "INFORMATION",
  "OBJECTION",
  "CONSENT",
])
export const privacyRequestInputSchema = z.strictObject({
  kind: privacyRequestKindSchema,
  message: textField(1200),
})
export const privacyExportInputSchema = z.strictObject({
  currentPassword: currentPasswordField,
})
export const privacyRequestSchema = z.strictObject({
  id: uuid,
  kind: privacyRequestKindSchema,
  message: z.string().max(1200),
  status: z.enum(["RECEIVED", "IN_REVIEW", "COMPLETED", "DECLINED"]),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  response: z.string().max(2000).nullable(),
})
export type PrivacyRequest = z.infer<typeof privacyRequestSchema>
export const legalAcceptanceRecordSchema = z.strictObject({
  termsVersion: z.string().max(40),
  privacyVersion: z.string().max(40),
  acceptedAt: z.iso.datetime(),
})
export const privacyAccountSchema = z.strictObject({
  id: uuid,
  name: personNameField,
  email: emailField,
  createdAt: z.iso.datetime(),
})
export const privacyProfileSchema = z.strictObject({
  account: privacyAccountSchema,
  acceptance: legalAcceptanceRecordSchema.nullable(),
  requests: z.array(privacyRequestSchema).max(100),
})
export type PrivacyProfile = z.infer<typeof privacyProfileSchema>
export const privacyExportSchema = z.strictObject({
  generatedAt: z.iso.datetime(),
  account: privacyAccountSchema,
  acceptances: z.array(legalAcceptanceRecordSchema),
  requests: z.array(privacyRequestSchema),
  memberships: z.array(
    z.strictObject({
      tenantId: uuid,
      tenantName: z.string(),
      role: z.string(),
      active: z.boolean(),
    }),
  ),
  sessions: z.array(
    z.strictObject({
      createdAt: z.iso.datetime(),
      expiresAt: z.iso.datetime(),
      revokedAt: z.iso.datetime().nullable(),
    }),
  ),
  securityEvents: z.array(
    z.strictObject({ action: z.string(), createdAt: z.iso.datetime() }),
  ),
})
export type PrivacyExport = z.infer<typeof privacyExportSchema>
