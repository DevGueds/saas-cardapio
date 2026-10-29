import {
  analyticsReportSchema,
  bestSellersSchema,
  type AnalyticsQuery,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { AnalyticsService } from "../application/ports"
export class HttpAnalytics implements AnalyticsService {
  constructor(private readonly client: ApiClient) {}
  report(id: string, query: AnalyticsQuery) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/analytics?${new URLSearchParams(query)}`,
      analyticsReportSchema,
    )
  }
  bestSellers(slug: string) {
    return this.client.request(
      `/public/restaurants/${encodeURIComponent(slug)}/best-sellers`,
      bestSellersSchema,
    )
  }
}
