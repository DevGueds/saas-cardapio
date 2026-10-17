import type { TextareaHTMLAttributes } from "react"
import { useFieldValidation, type ValidationProps } from "./use-field-validation"
export type ValidatedTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  ValidationProps
export default function ValidatedTextarea({
  schema,
  validation,
  ...props
}: ValidatedTextareaProps) {
  const field = useFieldValidation<HTMLTextAreaElement>({ ...props, schema, validation })
  return (
    <>
      <textarea {...props} {...field.control} />
      {field.error && (
        <small id={field.errorId} className="field-error" role="alert">
          {field.error}
        </small>
      )}
    </>
  )
}
