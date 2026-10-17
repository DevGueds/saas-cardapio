import { useState, type FormHTMLAttributes } from "react"
import { FormValidationContext, type RegisteredField } from "./context"
export default function ValidatedForm({
  children,
  onSubmit,
  onChangeCapture,
  onPointerDownCapture,
  onClickCapture,
  onKeyDownCapture,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  const [registry] = useState(() => ({
    fields: new Map<string, RegisteredField>(),
    pointerSubmit: false,
  }))
  const [invalid, setInvalid] = useState(false)
  return (
    <FormValidationContext.Provider value={registry}>
      <form
        {...props}
        noValidate
        onPointerDownCapture={(event) => {
          const button =
            event.target instanceof Element ? event.target.closest("button") : null
          registry.pointerSubmit =
            button?.type === "submit" && button.form === event.currentTarget
          onPointerDownCapture?.(event)
        }}
        onClickCapture={(event) => {
          registry.pointerSubmit = false
          onClickCapture?.(event)
        }}
        onKeyDownCapture={(event) => {
          registry.pointerSubmit = false
          onKeyDownCapture?.(event)
        }}
        onChangeCapture={(event) => {
          setInvalid(false)
          onChangeCapture?.(event)
        }}
        onSubmit={(event) => {
          const invalidFields = [...registry.fields.values()]
            .filter((field) => !field.validate())
            .sort((a, b) =>
              a.element.compareDocumentPosition(b.element) &
              Node.DOCUMENT_POSITION_FOLLOWING
                ? -1
                : 1,
            )
          if (invalidFields.length) {
            event.preventDefault()
            setInvalid(true)
            const element = invalidFields[0]!.element
            let parent = element.parentElement
            while (parent) {
              if (parent instanceof HTMLDetailsElement) parent.open = true
              parent = parent.parentElement
            }
            element.focus()
            return
          }
          setInvalid(false)
          onSubmit?.(event)
        }}
      >
        {invalid && (
          <p className="field-validation-summary" role="alert">
            Revise os campos destacados para continuar. Seus dados foram mantidos.
          </p>
        )}
        {children}
      </form>
    </FormValidationContext.Provider>
  )
}
