import {
  useContext,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react"
import type { z } from "zod"
import { FormValidationContext } from "./context"
import { fieldError, type FieldElement, type FieldRule } from "./field-rules"
import { formatField } from "./field-formatters"
export interface ValidationProps {
  schema?: z.ZodType
  validation?: FieldRule
}
export function useFieldValidation<T extends FieldElement>({
  schema,
  validation,
  onChange,
  onBlur,
  "aria-describedby": describedBy,
}: ValidationProps & {
  onChange?: (event: ChangeEvent<T>) => void
  onBlur?: (event: FocusEvent<T>) => void
  "aria-describedby"?: string
}) {
  const id = useId(),
    element = useRef<T>(null),
    registry = useContext(FormValidationContext)
  const [error, setError] = useState("")
  const touched = useRef(false)
  const validate = useCallback(
    (target: T) => {
      touched.current = true
      const next = fieldError(target, schema, validation)
      setError(next)
      return !next
    },
    [schema, validation],
  )
  useLayoutEffect(() => {
    const target = element.current
    if (!target) return
    // Keep the accessible name stable when feedback is rendered inside a label.
    if (!target.hasAttribute("aria-label") && !target.hasAttribute("aria-labelledby")) {
      const label = target.labels?.[0]?.querySelector(":scope > span")
      if (label) {
        if (!label.id) label.id = `${id}-label`
        target.setAttribute("aria-labelledby", label.id)
      }
    }
    if (!registry) return
    registry.fields.set(id, { element: target, validate: () => validate(target) })
    return () => {
      registry.fields.delete(id)
    }
  }, [id, registry, validate])
  return {
    error,
    errorId: `${id}-error`,
    control: {
      ref: element,
      "aria-invalid": !!error,
      "aria-describedby":
        [describedBy, error && `${id}-error`].filter(Boolean).join(" ") || undefined,
      onChange(event: ChangeEvent<T>) {
        onChange?.(event)
        if (touched.current) validate(event.currentTarget)
      },
      onBlur(event: FocusEvent<T>) {
        const target = event.currentTarget
        if (
          target instanceof HTMLInputElement &&
          !["password", "checkbox", "radio"].includes(target.type)
        ) {
          const format =
            validation === "personName"
              ? "name"
              : (validation ??
                (target.type === "email"
                  ? "email"
                  : target.type === "tel"
                    ? "phone"
                    : undefined))
          const formatted = formatField(target.value, format)
          if (formatted !== target.value) {
            target.value = formatted
            onChange?.(event)
          }
        }
        // A blur error can move the submit button between pointer-down and click.
        // The form validates every field on submit; defer this one blur to that step.
        const next = event.relatedTarget
        const submitting =
          registry?.pointerSubmit &&
          next instanceof HTMLButtonElement &&
          next.type === "submit" &&
          next.form === target.form
        if (!submitting) validate(target)
        onBlur?.(event)
      },
    },
  }
}
