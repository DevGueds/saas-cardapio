import { useMemo, useState } from "react"
import { printerProfileSchema, type PrinterProfile } from "@cardapio/contracts"
import Dialog from "../../../shared/presentation/Dialog"
import ValidatedForm from "../../../shared/presentation/form-validation/ValidatedForm"
import PrinterProfileForm from "./PrinterProfileForm"

export default function PrinterProfileDialog({
  initial,
  creating,
  canRemove,
  onApply,
  onRemove,
  onClose,
}: {
  initial: PrinterProfile
  creating: boolean
  canRemove: boolean
  onApply(profile: PrinterProfile): void
  onRemove(): void
  onClose(): void
}) {
  const [profile, setProfile] = useState(initial)
  const validation = useMemo(() => printerProfileSchema.safeParse(profile), [profile])
  return (
    <Dialog
      title={creating ? "Adicionar impressora" : "Ajustar impressora"}
      onClose={onClose}
      className="printer-profile-dialog"
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault()
          if (validation.success) onApply(validation.data)
        }}
      >
        <PrinterProfileForm profile={profile} onChange={setProfile} />
        <div className="printing-dialog-actions">
          {!creating && (
            <button
              type="button"
              className="text-button printing-remove"
              disabled={!canRemove}
              onClick={onRemove}
            >
              Remover impressora
            </button>
          )}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-button" disabled={!validation.success}>
              {creating ? "Adicionar" : "Aplicar ajustes"}
            </button>
          </div>
        </div>
      </ValidatedForm>
    </Dialog>
  )
}
