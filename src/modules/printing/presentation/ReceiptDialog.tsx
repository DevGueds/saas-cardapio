import { useCallback, useMemo, useState } from "react"
import type { ReceiptKind } from "@cardapio/contracts"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { SelectField } from "../../../shared/presentation/Fields"
import Dialog from "../../../shared/presentation/Dialog"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import { Failure } from "../../../shared/domain/failure"
import ReceiptPreview from "./ReceiptPreview"
import { receiptLabels } from "./receipt-labels"
import "./printing.css"

export default function ReceiptDialog({
  restaurantId,
  sourceId,
  kind,
  onClose,
}: {
  restaurantId: string
  sourceId: string
  kind: ReceiptKind
  onClose(): void
}) {
  const { printing } = useServices()
  const [profileId, setProfileId] = useState("")
  const load = useCallback(async () => {
    if (!printing)
      throw new Failure("CONFIGURATION", "Impressão indisponível neste ambiente.")
    const [document, settings] = await Promise.all([
      kind === "PAYMENT"
        ? printing.paymentDocument(restaurantId, sourceId)
        : printing.orderDocument(restaurantId, sourceId, kind),
      printing.settings(restaurantId),
    ])
    if (!document.ok) return document
    if (!settings.ok) return settings
    return {
      ok: true as const,
      value: { document: document.value, settings: settings.value },
    }
  }, [printing, restaurantId, sourceId, kind])
  const resource = useResource(load)
  const document = useMemo(() => {
    if (!resource.data) return null
    const profile =
      resource.data.settings.profiles.find((p) => p.id === profileId) ??
      resource.data.document.profile
    return { ...resource.data.document, profile }
  }, [resource.data, profileId])
  return (
    <Dialog title={receiptLabels[kind]} onClose={onClose} className="receipt-dialog">
      <p className="printing-status">
        Documento não fiscal · situação registrada na consulta
      </p>
      {resource.loading && <p role="status">Conferindo dados e preparando documento…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.data && document && !resource.error && !resource.loading && (
        <>
          <SelectField
            label="Perfil de impressão"
            value={document.profile.id}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {resource.data.settings.profiles.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.paperWidthMm} mm
              </option>
            ))}
          </SelectField>
          <ReceiptPreview document={document} />
          <button
            type="button"
            className="text-button"
            onClick={() => void resource.reload()}
          >
            Atualizar situação registrada
          </button>
        </>
      )}
    </Dialog>
  )
}
