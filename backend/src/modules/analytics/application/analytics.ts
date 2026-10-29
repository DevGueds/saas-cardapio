import {
  analyticsQuerySchema,
  analyticsReportSchema,
  bestSellersSchema,
} from "@cardapio/contracts"
import { analyticsWindow } from "@cardapio/domain/analytics"
import { requireValid } from "@cardapio/domain/failure"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Actor } from "../../identity/domain/identity.js"
import type { MenuRepository } from "../../catalog/application/ports.js"
import type {
  Clock,
  SecretTokens,
  RequestLimiter,
} from "../../../shared/application/ports.js"
import type { CacheStore } from "../../../shared/application/cache.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { AnalyticsRepository } from "./ports.js"
export class Analytics {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly access: AccessPolicy,
    private readonly menus: MenuRepository,
    private readonly clock: Clock,
    private readonly secrets: SecretTokens,
    private readonly limiter: RequestLimiter,
    private readonly cache: CacheStore,
    private readonly operation: Operation,
  ) {}
  report(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("analytics.report", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "reports:read")
      const query = validate(analyticsQuerySchema, input),
        now = this.clock.now()
      await this.limiter.consume("analytics-report:" + actor.userId, 60, 60)
      const range = analyticsWindow(
        query.period,
        query.date,
        await this.repository.timeZone(scope),
        now.getTime(),
      )
      const data = await this.repository.snapshot(scope, range),
        { buckets: _buckets, ...publicRange } = range
      return analyticsReportSchema.parse({
        ...data,
        generatedAt: now.toISOString(),
        range: publicRange,
        customers: data.customers.map(({ phone, ...customer }) => ({
          ...customer,
          id: this.secrets.fingerprint(
            `analytics-customer:${scope.tenantId}:${scope.restaurantId}:${phone}`,
          ),
          phoneMasked: phone ? `•• •••••-${phone.slice(-4)}` : "Não informado",
        })),
      })
    })
  }
  bestSellers(slug: string, ip: string) {
    return this.operation.run("analytics.best-sellers", async () => {
      requireValid(
        slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
        "Endereço de cardápio inválido.",
      )
      await this.limiter.consume("best-sellers:" + ip, 120, 60)
      const scope = await this.menus.resolve(slug),
        key = `best-sellers:${scope.restaurantId}`
      const cached = await this.cache.get(key)
      if (cached !== null) return bestSellersSchema.parse(JSON.parse(cached))
      const now = this.clock.now(),
        productIds = await this.repository.bestSellers(
          scope,
          new Date(now.getTime() - 30 * 86400000),
          now,
        )
      const result = bestSellersSchema.parse({ productIds, days: 30 })
      await this.cache.set(key, JSON.stringify(result), 60)
      return result
    })
  }
}
