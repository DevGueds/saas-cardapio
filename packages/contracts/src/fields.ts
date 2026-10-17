import { z } from "zod"
import { brazilianPhone, imageReference } from "@cardapio/domain/validation"
import { parseMoney } from "@cardapio/domain/money"

// Input contracts are shared by the browser and API. Drafts deliberately remain
// more permissive: an unfinished field must survive a reload without being erased.
export function textField(max = 120, required = false, min = 1) {
  return z
    .string({ error: "Informe um texto válido." })
    .trim()
    .normalize("NFC")
    .max(max, `Use no máximo ${max} caracteres.`)
    .refine(
      (v) => !required || v.length >= min,
      min === 1 ? "Preencha este campo." : `Use pelo menos ${min} caracteres.`,
    )
    .refine(
      (v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(v),
      "Remova os caracteres de controle deste campo.",
    )
}
export const labelField = textField(120, true)
export const personNameField = textField(120, true, 2)
  .refine(
    (v) => /^[\p{L}\p{M}][\p{L}\p{M} .’'\-]*$/u.test(v),
    "Use letras no nome; acentos, espaços, apóstrofos e hífens são aceitos.",
  )
  .transform((v) => v.replace(/\s+/g, " "))
export const emailField = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .toLowerCase()
  .max(254, "Use um e-mail de até 254 caracteres.")
  .pipe(z.email({ error: "Informe um e-mail válido, como nome@exemplo.com." }))
export const slugField = z
  .string()
  .trim()
  .min(3, "Use pelo menos 3 caracteres no endereço.")
  .max(80, "Use no máximo 80 caracteres no endereço.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras minúsculas, números e hífens entre as palavras.",
  )
export const passwordField = z
  .string({ error: "Informe uma senha." })
  .refine((v) => Array.from(v).length >= 8, "Use pelo menos 8 caracteres na senha.")
  .refine((v) => Array.from(v).length <= 128, "Use no máximo 128 caracteres na senha.")
export const currentPasswordField = z
  .string({ error: "Informe sua senha." })
  .min(1, "Informe sua senha.")
  .max(512, "A senha excede o limite de 512 caracteres.")
function phoneSchema(optional = false) {
  return z
    .string({ error: "Informe um telefone com DDD." })
    .trim()
    .max(30, "O telefone excede o limite de 30 caracteres.")
    .transform((value, context) => {
      if (optional && value === "") return ""
      try {
        return brazilianPhone(value)
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof Error
              ? error.message
              : "Informe um telefone brasileiro com DDD.",
        })
        return z.NEVER
      }
    })
}
export const phoneField = phoneSchema()
export const optionalPhoneField = phoneSchema(true)
export function moneyField(positive = false, optional = false) {
  return z
    .string({ error: "Informe um valor em reais." })
    .max(20, "O valor é muito longo.")
    .superRefine((value, context) => {
      if (optional && value.trim() === "") return
      try {
        parseMoney(value, "value", positive)
      } catch {
        context.addIssue({
          code: "custom",
          message: positive
            ? "Use um valor maior que zero, como 28,90, com até 2 casas decimais e sem milhares."
            : "Use um valor a partir de zero, como 0,00, com até 2 casas decimais e sem milhares.",
        })
      }
    })
}
export const couponField = z
  .string()
  .trim()
  .toUpperCase()
  .max(30, "Use no máximo 30 caracteres no cupom.")
  .refine(
    (v) => !v || /^[A-Z0-9_-]{3,30}$/.test(v),
    "Use de 3 a 30 letras, números, hífens ou _ no cupom.",
  )
export const postalCodeField = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, "Informe os 8 números do CEP, como 01001-000.")
export const optionalPostalCodeField = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || postalCodeField.safeParse(v).success,
    "Informe os 8 números do CEP, como 01001-000, ou deixe vazio.",
  )
export function integerTextField(min: number, max: number) {
  return z
    .string()
    .refine(
      (v) =>
        /^\d+$/.test(v) &&
        Number.isSafeInteger(Number(v)) &&
        Number(v) >= min &&
        Number(v) <= max,
      `Informe um número inteiro entre ${min} e ${max}.`,
    )
}
export function coordinateField(limit: number) {
  return z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (/^-?\d+(?:[.,]\d+)?$/.test(v) &&
          Number.isFinite(Number(v.replace(",", "."))) &&
          Math.abs(Number(v.replace(",", "."))) <= limit),
      `Use um número entre -${limit} e ${limit}, ou deixe vazio.`,
    )
}
export const localDateTimeField = z.iso.datetime({
  local: true,
  error: "Informe uma data e um horário válidos.",
})
export const imageField = z
  .string()
  .max(7_000_000, "A imagem deve ter até 5 MB.")
  .superRefine((value, context) => {
    try {
      imageReference(value)
    } catch {
      context.addIssue({
        code: "custom",
        message: "Use uma imagem PNG, JPEG ou WebP de até 5 MB, ou uma URL HTTPS válida.",
      })
    }
  })
export const imageUploadSchema = z.object({
  type: z.enum(["image/png", "image/jpeg", "image/webp"], {
    error: "Selecione uma imagem PNG, JPEG ou WebP.",
  }),
  size: z
    .number()
    .int()
    .positive("O arquivo está vazio.")
    .max(5 * 1024 * 1024, "A imagem deve ter no máximo 5 MB."),
})
export const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const
export const stateField = z.enum(brazilianStates, {
  error: "Selecione um estado brasileiro válido.",
})

// Never expose Zod's default messages containing enum values or untrusted data.
export function validationMessage(issue: { message: string }): string {
  return /^(Invalid|Too |Unrecognized)/.test(issue.message)
    ? "Confira este campo. O valor está ausente, inválido ou excede o limite."
    : issue.message
}
