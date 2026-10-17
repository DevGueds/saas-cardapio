import { z } from "zod"
import {
  textField,
  emailField,
  phoneField,
  optionalPhoneField,
  optionalPostalCodeField,
  moneyField,
  personNameField,
  slugField,
  couponField,
  coordinateField,
  integerTextField,
  localDateTimeField,
  currentPasswordField,
  validationMessage,
} from "@cardapio/contracts"
import type { FieldFormat } from "./field-formatters"
export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
export type FieldRule = FieldFormat | "personName"
export function fieldError(
  element: FieldElement,
  schema?: z.ZodType,
  rule?: FieldRule,
): string {
  if (element.matches(":disabled") || ("readOnly" in element && element.readOnly))
    return ""
  const raw = element.value
  let input: unknown = raw
  let validator = schema
  if (!validator) {
    if (element instanceof HTMLSelectElement) {
      validator = z
        .string()
        .refine(
          (v) =>
            (!element.required || v !== "") &&
            [...element.options].some((o) => o.value === v && !o.disabled),
          "Selecione uma opção válida.",
        )
    } else if (
      element instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(element.type)
    ) {
      input = element.checked
      validator =
        element.required && element.type === "checkbox"
          ? z.literal(true, { error: "Marque esta opção para continuar." })
          : z.boolean()
    } else if (rule === "personName") validator = personNameField
    else if (rule === "name")
      validator = textField(
        "maxLength" in element && element.maxLength > 0 ? element.maxLength : 120,
        true,
      )
    else if (rule === "email" || element.type === "email") validator = emailField
    else if (rule === "phone" || element.type === "tel")
      validator = element.required ? phoneField : optionalPhoneField
    else if (rule === "cep") validator = optionalPostalCodeField
    else if (rule === "money") validator = moneyField(false, !element.required)
    else if (rule === "slug") validator = slugField
    else if (rule === "coupon") validator = couponField
    else if (rule === "coordinate") validator = coordinateField(180)
    else if (element.type === "datetime-local") validator = localDateTimeField
    else if (element.type === "password") validator = currentPasswordField
    else if (element instanceof HTMLInputElement && element.type === "number") {
      validator = integerTextField(
        Number(element.min || 0),
        Number(element.max || Number.MAX_SAFE_INTEGER),
      )
    } else
      validator = textField(
        "maxLength" in element && element.maxLength > 0 ? element.maxLength : 500,
        element.required,
        "minLength" in element && element.minLength > 0 ? element.minLength : 1,
      )
  }
  const result = validator.safeParse(input)
  return result.success ? "" : validationMessage(result.error.issues[0]!)
}
