import {
  printingSettingsSchema,
  receiptDocumentSchema,
  type PrintingSettings,
  type ReceiptKind,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { PrintingService } from "../application/printing"

export class HttpPrinting implements PrintingService {
  constructor(private readonly client: ApiClient) {}
  settings(id: string) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/printing/settings`,
      printingSettingsSchema,
    )
  }
  saveSettings(id: string, settings: PrintingSettings) {
    const { revision, ...values } = settings
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/printing/settings`,
      printingSettingsSchema,
      {
        method: "PUT",
        body: { ...values, expectedRevision: revision },
      },
    )
  }
  orderDocument(id: string, orderId: string, kind: Exclude<ReceiptKind, "PAYMENT">) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/orders/${encodeURIComponent(orderId)}/documents/${kind}`,
      receiptDocumentSchema,
    )
  }
  paymentDocument(id: string, paymentId: string) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/document`,
      receiptDocumentSchema,
    )
  }
}
