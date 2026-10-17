import type { InputHTMLAttributes } from "react"
import { useFieldValidation, type ValidationProps } from "./use-field-validation"
export type ValidatedInputProps = InputHTMLAttributes<HTMLInputElement> & ValidationProps
export default function ValidatedInput({
  schema,
  validation,
  ...props
}: ValidatedInputProps) {
  const field = useFieldValidation<HTMLInputElement>({ ...props, schema, validation })
  return (
    <>
      <input {...props} {...field.control} />
      {field.error && (
        <small id={field.errorId} className="field-error" role="alert">
          {field.error}
        </small>
      )}
    </>
  )
}
