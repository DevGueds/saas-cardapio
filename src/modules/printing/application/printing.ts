import type { PrintingSettings, ReceiptDocument, ReceiptKind } from "@cardapio/contracts"
import type { Result } from "../../../shared/application/result"

export interface PrintingService {
  settings(restaurantId: string): Promise<Result<PrintingSettings>>
  saveSettings(
    restaurantId: string,
    settings: PrintingSettings,
  ): Promise<Result<PrintingSettings>>
  orderDocument(
    restaurantId: string,
    orderId: string,
    kind: Exclude<ReceiptKind, "PAYMENT">,
  ): Promise<Result<ReceiptDocument>>
  paymentDocument(
    restaurantId: string,
    paymentId: string,
  ): Promise<Result<ReceiptDocument>>
}
