import type {
  OrderView,
  PaymentView,
  PrintingSettings,
  ReceiptKind,
  Role,
  UpdatePrintingSettings,
} from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"

export interface PrintingSource {
  settings: PrintingSettings
  restaurant: { id: string; name: string; address: string; phone: string }
  order: OrderView | null
  payment: PaymentView | null
  payments: PaymentView[]
}
export interface PrintingRepository {
  settings(scope: TenantScope): Promise<PrintingSettings>
  update(scope: TenantScope, input: UpdatePrintingSettings): Promise<PrintingSettings>
  source(
    scope: TenantScope,
    kind: ReceiptKind,
    id: string,
    operator: { userId: string; role: Role },
  ): Promise<PrintingSource>
}
export interface PrintingLogoValidator {
  validate(logo: string): Promise<boolean>
}
