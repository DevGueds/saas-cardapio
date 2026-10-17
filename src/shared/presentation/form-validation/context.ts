import { createContext } from "react"
import type { FieldElement } from "./field-rules"
export type RegisteredField = { element: FieldElement; validate(): boolean }
export interface FormRegistry {
  fields: Map<string, RegisteredField>
  pointerSubmit: boolean
}
export const FormValidationContext = createContext<FormRegistry | null>(null)
