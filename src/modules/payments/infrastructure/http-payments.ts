import {
  financialReportSchema,
  orderBalanceSchema,
  paymentPageSchema,
  paymentSchema,
  type PaymentInput,
  type ReportRange,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { PaymentsService } from "../application/ports"
export class HttpPayments implements PaymentsService {
  constructor(private readonly client: ApiClient) {}
  private path(id: string) {
    return `/restaurants/${encodeURIComponent(id)}`
  }
  record(id: string, input: PaymentInput) {
    return this.client.request(`${this.path(id)}/payments`, paymentSchema, {
      method: "POST",
      body: input,
    })
  }
  reverse(id: string, paymentId: string, reason: string) {
    return this.client.request(
      `${this.path(id)}/payments/${encodeURIComponent(paymentId)}/reverse`,
      paymentSchema,
      { method: "POST", body: { reason } },
    )
  }
  balance(id: string, orderId: string) {
    return this.client.request(
      `${this.path(id)}/orders/${encodeURIComponent(orderId)}/balance`,
      orderBalanceSchema,
    )
  }
  list(id: string, range: ReportRange, cursor?: string) {
    return this.client.request(
      `${this.path(id)}/payments?${new URLSearchParams({ ...range, ...(cursor ? { cursor } : {}) })}`,
      paymentPageSchema,
    )
  }
  report(id: string, range: ReportRange) {
    return this.client.request(
      `${this.path(id)}/reports/financial?${new URLSearchParams(range)}`,
      financialReportSchema,
    )
  }
}
