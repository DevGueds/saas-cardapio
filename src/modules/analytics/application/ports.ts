import type { AnalyticsQuery, AnalyticsReport, BestSellers } from "@cardapio/contracts"
import type { Result } from "../../../shared/application/result"
export interface AnalyticsService {
  report(restaurantId: string, query: AnalyticsQuery): Promise<Result<AnalyticsReport>>
  bestSellers(slug: string): Promise<Result<BestSellers>>
}
