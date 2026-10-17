import type { ValidatedInputProps } from "./form-validation/ValidatedInput"
import ValidatedInput from "./form-validation/ValidatedInput"
import ValidatedSelect from "./form-validation/ValidatedSelect"
import { useId, type ReactNode, type SelectHTMLAttributes } from "react"
export function InputField({
  label,
  help,
  ...props
}: ValidatedInputProps & { label: string; help?: string }) {
  const id = useId()
  return (
    <label className="field">
      <span>
        <span id={id}>{label}</span>
        {props.required && <span aria-hidden="true"> *</span>}
      </span>
      <ValidatedInput
        aria-labelledby={id}
        aria-describedby={help ? id + "-help" : undefined}
        {...props}
      />
      {help && (
        <small id={id + "-help"} className="field-help">
          {help}
        </small>
      )}
    </label>
  )
}
export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <label className="field">
      <span id={id}>{label}</span>
      <ValidatedSelect aria-labelledby={id} {...props}>
        {children}
      </ValidatedSelect>
    </label>
  )
}
export function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange(value: boolean): void
  disabled?: boolean
}) {
  return (
    <label className="check-field">
      <ValidatedInput
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  )
}
export function FormActions({
  busy,
  onCancel,
  label = "Salvar alterações",
}: {
  busy: boolean
  onCancel?: () => void
  label?: string
}) {
  return (
    <div className="form-actions">
      {onCancel && (
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onCancel}
        >
          Fechar
        </button>
      )}
      <button className="primary-button" disabled={busy}>
        {busy ? "Salvando…" : label}
      </button>
    </div>
  )
}
