import type { AnalyticsReport, AnalyticsMetrics } from "@cardapio/contracts"
import type { AnalyticsWindow } from "@cardapio/domain/analytics"
import type { TenantScope } from "../../identity/domain/identity.js"
export type AnalyticsSnapshot = Omit<
  AnalyticsReport,
  "range" | "generatedAt" | "customers"
> & {
  customers: {
    phone: string
    name: string
    orders: number
    total: number
    lastPurchase: string
  }[]
}
export interface AnalyticsRepository {
  timeZone(scope: TenantScope): Promise<string>
  snapshot(scope: TenantScope, range: AnalyticsWindow): Promise<AnalyticsSnapshot>
  bestSellers(scope: TenantScope, since: Date, until: Date): Promise<string[]>
}
export type { AnalyticsMetrics }
