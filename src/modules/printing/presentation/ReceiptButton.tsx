import { lazy, memo, Suspense, useState } from "react"
import { Printer } from "lucide-react"
import type { ReceiptKind } from "@cardapio/contracts"
import { canPrintReceipt } from "@cardapio/domain/printing"
import { useAccount } from "../../identity/presentation/AccountContext"
import { useServices } from "../../../app/presentation/ServicesProvider"
import FeatureBoundary from "../../../shared/presentation/FeatureBoundary"
import { receiptLabels } from "./receipt-labels"
const ReceiptDialog = lazy(() => import("./ReceiptDialog"))

function ReceiptButton({
  restaurantId,
  sourceId,
  kind,
  disabled = false,
  compact = false,
}: {
  restaurantId: string
  sourceId: string
  kind: ReceiptKind
  disabled?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { printing, receiptOutput } = useServices()
  const account = useAccount()
  if (
    !printing ||
    !receiptOutput ||
    !account ||
    !canPrintReceipt(account.restaurant.role, kind)
  )
    return null
  return (
    <>
      <button
        type="button"
        className={compact ? "text-button" : "secondary-button"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Printer size={17} aria-hidden="true" />{" "}
        {compact ? "Comprovante" : receiptLabels[kind]}
      </button>
      {open && (
        <FeatureBoundary label="Comprovante" resetKeys={[sourceId, kind]}>
          <Suspense fallback={<p role="status">Abrindo comprovante…</p>}>
            <ReceiptDialog
              restaurantId={restaurantId}
              sourceId={sourceId}
              kind={kind}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </FeatureBoundary>
      )}
    </>
  )
}
export default memo(ReceiptButton)
