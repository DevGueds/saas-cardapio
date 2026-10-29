import { Prisma } from "../../../generated/prisma/client.js"
import { analyticsMetricsSchema, analyticsProductSchema } from "@cardapio/contracts"
import { parseStoreHours } from "@cardapio/domain/store-hours"
import type { AnalyticsWindow } from "@cardapio/domain/analytics"
import type { AnalyticsRepository, AnalyticsSnapshot } from "../application/ports.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
const scopeWhere = (scope: TenantScope) =>
  Prisma.sql`o."tenantId" = ${scope.tenantId}::uuid AND o."restaurantId" = ${scope.restaurantId}::uuid`
const rangeWhere = (scope: TenantScope, from: string, to: string) =>
  Prisma.sql`${scopeWhere(scope)} AND o."createdAt" >= ${new Date(from)} AND o."createdAt" < ${new Date(to)}`
const phone = (alias: "o" | "h") => {
  const digits = Prisma.sql`regexp_replace(${Prisma.raw(alias)}.customer->>'phone', '[^0-9]', '', 'g')`
  return Prisma.sql`CASE WHEN length(${digits}) IN (10,11) THEN '55' || ${digits} ELSE ${digits} END`
}
// JSON projections stay in the database: no order messages, addresses or histories enter logs or workers.
async function metrics(tx: Transaction, scope: TenantScope, from: string, to: string) {
  const rows = await tx.$queryRaw<unknown[]>(Prisma.sql`
    WITH selected AS (
      SELECT o.id, o."createdAt", o.status, o.subtotal, o.total, o.discount, o."deliveryFee", o.fulfillment, o.history,
        ${phone("o")} AS phone FROM "Order" o WHERE ${rangeWhere(scope, from, to)}
    ), period_buyers AS (
      SELECT s.phone, count(*) AS purchases FROM selected s
      WHERE s.status = 'COMPLETED' AND coalesce(s.phone, '') <> '' GROUP BY s.phone
    ), prior_buyers AS (
      SELECT DISTINCT ${phone("h")} AS phone FROM "Order" h
      WHERE h."tenantId" = ${scope.tenantId}::uuid AND h."restaurantId" = ${scope.restaurantId}::uuid
        AND h.status = 'COMPLETED' AND h."createdAt" < ${new Date(from)}
    ), buyers AS (
      SELECT b.phone, b.purchases, (p.phone IS NOT NULL) AS was_customer
      FROM period_buyers b LEFT JOIN prior_buyers p ON p.phone = b.phone
    ), times AS (
      SELECT s."createdAt", s.fulfillment,
        min((e->>'at')::timestamptz) FILTER (WHERE e->>'status' IN ('READY','OUT_FOR_DELIVERY','COMPLETED')) AS ready,
        min((e->>'at')::timestamptz) FILTER (WHERE e->>'status' = 'OUT_FOR_DELIVERY') AS dispatched,
        min((e->>'at')::timestamptz) FILTER (WHERE e->>'status' = 'COMPLETED') AS completed
      FROM selected s LEFT JOIN LATERAL jsonb_array_elements(coalesce(s.history,'[]'::jsonb)) e ON true
      WHERE s.status = 'COMPLETED' GROUP BY s.id, s."createdAt", s.fulfillment
    )
    SELECT count(*)::float8 AS orders,
      count(*) FILTER (WHERE status='COMPLETED')::float8 AS completed,
      count(*) FILTER (WHERE status='CANCELLED')::float8 AS cancelled,
      count(*) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED'))::float8 AS "inProgress",
      coalesce(sum(total) FILTER (WHERE status='COMPLETED'),0)::float8 AS revenue,
      coalesce(sum(subtotal) FILTER (WHERE status='COMPLETED'),0)::float8 AS "itemsRevenue",
      coalesce(sum(discount) FILTER (WHERE status='COMPLETED'),0)::float8 AS discounts,
      coalesce(sum("deliveryFee") FILTER (WHERE status='COMPLETED'),0)::float8 AS "deliveryFees",
      (SELECT count(*)::float8 FROM buyers) AS customers,
      (SELECT count(*) FILTER (WHERE NOT was_customer)::float8 FROM buyers) AS "newCustomers",
      (SELECT count(*) FILTER (WHERE was_customer)::float8 FROM buyers) AS "returningCustomers",
      (SELECT count(*) FILTER (WHERE purchases >= 2)::float8 FROM buyers) AS "repeatCustomers",
      count(*) FILTER (WHERE status='COMPLETED' AND coalesce(fulfillment->>'mode','DELIVERY')='DELIVERY')::float8 AS deliveries,
      count(*) FILTER (WHERE status='COMPLETED' AND fulfillment->>'mode'='PICKUP')::float8 AS pickups,
      (SELECT avg(extract(epoch FROM ready-"createdAt")/60)::float8 FROM times WHERE ready >= "createdAt") AS "avgPreparationMinutes",
      (SELECT count(*)::float8 FROM times WHERE ready >= "createdAt") AS "preparationSamples",
      (SELECT avg(extract(epoch FROM completed-dispatched)/60)::float8 FROM times WHERE completed >= dispatched AND coalesce(fulfillment->>'mode','DELIVERY')='DELIVERY') AS "avgDeliveryMinutes",
      (SELECT count(*)::float8 FROM times WHERE completed >= dispatched AND coalesce(fulfillment->>'mode','DELIVERY')='DELIVERY') AS "deliverySamples"
    FROM selected`)
  return analyticsMetricsSchema.parse(rows[0])
}
export class PrismaAnalytics implements AnalyticsRepository {
  constructor(private readonly db: Database) {}
  timeZone(scope: TenantScope) {
    return this.db.run(async (tx) => {
      const store = await tx.restaurant.findFirstOrThrow({
        where: { id: scope.restaurantId, tenantId: scope.tenantId },
        select: { hours: true },
      })
      return store.hours ? parseStoreHours(store.hours).timeZone : "America/Sao_Paulo"
    })
  }
  snapshot(scope: TenantScope, range: AnalyticsWindow): Promise<AnalyticsSnapshot> {
    return this.db.snapshot(async (tx) => {
      const current = await metrics(tx, scope, range.from, range.to)
      const previous = await metrics(tx, scope, range.previousFrom, range.previousTo)
      const where = rangeWhere(scope, range.from, range.to)
      const bucket =
        range.period === "DAY" ? "hour" : range.period === "YEAR" ? "month" : "day"
      const timeline = await tx.$queryRaw<
        { key: string; orders: number; revenue: number }[]
      >(Prisma.sql`
        SELECT to_char(date_trunc(${bucket}, o."createdAt" AT TIME ZONE ${range.timeZone}), 'YYYY-MM-DD"T"HH24:MI') AS key,
          count(*)::float8 AS orders, coalesce(sum(o.total),0)::float8 AS revenue
        FROM "Order" o WHERE ${where} AND o.status='COMPLETED' GROUP BY 1 ORDER BY 1`)
      const products = await tx.$queryRaw<unknown[]>(Prisma.sql`
        SELECT (item->>'productId')::uuid AS id, (array_agg(item->>'name' ORDER BY o."createdAt" DESC, o.id DESC))[1] AS name,
          coalesce(item->>'kind','PRODUCT') AS kind, sum((item->>'quantity')::bigint)::float8 AS units,
          sum((item->>'quantity')::bigint * (item->>'unitPrice')::bigint)::float8 AS revenue
        FROM "Order" o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
        WHERE ${where} AND o.status='COMPLETED' GROUP BY 1,3 ORDER BY units DESC, revenue DESC, id LIMIT 10`)
      const customers = await tx.$queryRaw<AnalyticsSnapshot["customers"]>(Prisma.sql`
        SELECT ${phone("o")} AS phone, (array_agg(o.customer->>'name' ORDER BY o."createdAt" DESC, o.id DESC))[1] AS name,
          count(*)::float8 AS orders, sum(o.total)::float8 AS total, to_char(max(o."createdAt") AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastPurchase"
        FROM "Order" o WHERE ${where} AND o.status='COMPLETED' AND coalesce(${phone("o")},'') <> ''
        GROUP BY 1 ORDER BY orders DESC, total DESC, phone LIMIT 10`)
      const couriers = await tx.$queryRaw<AnalyticsSnapshot["couriers"]>(Prisma.sql`
        SELECT CASE WHEN m."userId" IS NOT NULL THEN u.id ELSE null END AS id,
          CASE WHEN m."userId" IS NOT NULL THEN u.name ELSE 'Sem vínculo atual' END AS name,
          count(*)::float8 AS deliveries, avg(extract(epoch FROM times.completed-times.dispatched)/60)::float8 AS "avgMinutes"
        FROM "Order" o
        LEFT JOIN "Membership" m ON m."userId"=o."courierId" AND m."tenantId"=${scope.tenantId}::uuid
        LEFT JOIN "User" u ON u.id=m."userId"
        LEFT JOIN LATERAL (
          SELECT min((e->>'at')::timestamptz) FILTER (WHERE e->>'status'='OUT_FOR_DELIVERY') AS dispatched,
            min((e->>'at')::timestamptz) FILTER (WHERE e->>'status'='COMPLETED') AS completed
          FROM jsonb_array_elements(coalesce(o.history,'[]'::jsonb)) e
        ) times ON times.completed >= times.dispatched
        WHERE ${where} AND o.status='COMPLETED' AND o."courierId" IS NOT NULL AND coalesce(o.fulfillment->>'mode','DELIVERY')='DELIVERY'
        GROUP BY 1,2 ORDER BY deliveries DESC, name, id LIMIT 10`)
      const busyHours = await tx.$queryRaw<AnalyticsSnapshot["busyHours"]>(Prisma.sql`
        SELECT extract(hour FROM o."createdAt" AT TIME ZONE ${range.timeZone})::int AS hour, count(*)::float8 AS orders
        FROM "Order" o WHERE ${where} AND o.status <> 'CANCELLED' GROUP BY 1 ORDER BY 1`)
      const weekdays = await tx.$queryRaw<AnalyticsSnapshot["weekdays"]>(Prisma.sql`
        SELECT extract(dow FROM o."createdAt" AT TIME ZONE ${range.timeZone})::int AS day, count(*)::float8 AS orders
        FROM "Order" o WHERE ${where} AND o.status <> 'CANCELLED' GROUP BY 1 ORDER BY 1`)
      const paymentMethods = await tx.$queryRaw<
        AnalyticsSnapshot["paymentMethods"]
      >(Prisma.sql`
        SELECT coalesce(o.customer->>'payment','Não informado') AS name, count(*)::float8 AS orders
        FROM "Order" o WHERE ${where} AND o.status='COMPLETED' GROUP BY 1 ORDER BY orders DESC, name LIMIT 20`)
      const promotions = await tx.$queryRaw<AnalyticsSnapshot["promotions"]>(Prisma.sql`
        SELECT coalesce(o."promotionName",'Desconto aplicado') AS name, count(*)::float8 AS orders, sum(o.discount)::float8 AS discounts
        FROM "Order" o WHERE ${where} AND o.status='COMPLETED' AND (o."promotionId" IS NOT NULL OR o.discount>0)
        GROUP BY 1 ORDER BY orders DESC, name LIMIT 10`)
      return {
        current,
        previous,
        products: products.map((p) => analyticsProductSchema.parse(p)),
        customers,
        couriers,
        busyHours,
        weekdays,
        paymentMethods,
        promotions,
        series: range.buckets.map((b) => ({
          ...b,
          orders: timeline.find((t) => t.key === b.key)?.orders ?? 0,
          revenue: timeline.find((t) => t.key === b.key)?.revenue ?? 0,
        })),
      }
    })
  }
  bestSellers(scope: TenantScope, since: Date, until: Date) {
    return this.db.run(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id FROM "Order" o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
        JOIN "Product" p ON p.id=(item->>'productId')::uuid AND p."tenantId"=o."tenantId" AND p."restaurantId"=o."restaurantId" AND p.available
        WHERE ${scopeWhere(scope)} AND o.status='COMPLETED' AND o."createdAt">=${since} AND o."createdAt"<${until}
          AND coalesce(item->>'kind','PRODUCT')='PRODUCT'
        GROUP BY p.id ORDER BY sum((item->>'quantity')::bigint) DESC, p.id LIMIT 20`)
      return rows.map((row) => row.id)
    })
  }
}
