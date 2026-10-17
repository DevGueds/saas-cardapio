import type { SelectHTMLAttributes } from "react"
import { useFieldValidation, type ValidationProps } from "./use-field-validation"
export type ValidatedSelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  ValidationProps
export default function ValidatedSelect({
  schema,
  validation,
  ...props
}: ValidatedSelectProps) {
  const field = useFieldValidation<HTMLSelectElement>({ ...props, schema, validation })
  return (
    <>
      <select {...props} {...field.control} />
      {field.error && (
        <small id={field.errorId} className="field-error" role="alert">
          {field.error}
        </small>
      )}
    </>
  )
}
