import type {
  FinancialReport,
  OrderBalance,
  PaymentInput,
  PaymentPage,
  PaymentView,
  ReportOrder,
  ReportRange,
} from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"

export interface PaymentDraft extends Omit<PaymentInput, "requestId" | "amount"> {
  id: string
  amount: number
  requestHash: string
  payloadHash: string
  recordedBy: string
  now: Date
}
export interface PaymentsRepository {
  record(scope: TenantScope, draft: PaymentDraft): Promise<PaymentView>
  reverse(
    scope: TenantScope,
    id: string,
    actor: string,
    reason: string,
    now: Date,
  ): Promise<PaymentView>
  balance(scope: TenantScope, orderId: string): Promise<OrderBalance>
  list(scope: TenantScope, range: ReportRange, cursor?: string): Promise<PaymentPage>
  report(
    scope: TenantScope,
    range: ReportRange,
  ): Promise<{ orders: ReportOrder[]; payments: PaymentView[] }>
}
export interface FinancialReportCalculator {
  calculate(
    range: ReportRange,
    orders: ReportOrder[],
    payments: PaymentView[],
    generatedAt: string,
  ): Promise<FinancialReport>
}
