import type {
  FinancialReport,
  OrderBalance,
  PaymentInput,
  PaymentPage,
  PaymentView,
  ReportRange,
  Result,
} from "@cardapio/contracts"
export interface PaymentsService {
  record(restaurantId: string, input: PaymentInput): Promise<Result<PaymentView>>
  reverse(restaurantId: string, id: string, reason: string): Promise<Result<PaymentView>>
  balance(restaurantId: string, orderId: string): Promise<Result<OrderBalance>>
  list(
    restaurantId: string,
    range: ReportRange,
    cursor?: string,
  ): Promise<Result<PaymentPage>>
  report(restaurantId: string, range: ReportRange): Promise<Result<FinancialReport>>
}
