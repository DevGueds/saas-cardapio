import { z } from "zod"
import { uuid } from "./common.js"
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const duration = z.number().nonnegative().nullable()
export const analyticsQuerySchema = z.strictObject({
  period: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
  date: z.iso.date(),
})
export const analyticsMetricsSchema = z.strictObject({
  orders: count,
  completed: count,
  cancelled: count,
  inProgress: count,
  revenue: count,
  itemsRevenue: count,
  discounts: count,
  deliveryFees: count,
  customers: count,
  newCustomers: count,
  returningCustomers: count,
  repeatCustomers: count,
  deliveries: count,
  pickups: count,
  avgPreparationMinutes: duration,
  preparationSamples: count,
  avgDeliveryMinutes: duration,
  deliverySamples: count,
})
export const analyticsProductSchema = z.strictObject({
  id: uuid,
  name: z.string().max(120),
  kind: z.enum(["PRODUCT", "COMBO"]),
  units: count,
  revenue: count,
})
export const analyticsReportSchema = z.strictObject({
  generatedAt: z.iso.datetime(),
  range: z.strictObject({
    period: analyticsQuerySchema.shape.period,
    date: z.iso.date(),
    timeZone: z.string(),
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    previousFrom: z.iso.datetime(),
    previousTo: z.iso.datetime(),
    partial: z.boolean(),
    future: z.boolean(),
  }),
  current: analyticsMetricsSchema,
  previous: analyticsMetricsSchema,
  series: z
    .array(
      z.strictObject({
        key: z.string(),
        label: z.string(),
        future: z.boolean(),
        orders: count,
        revenue: count,
      }),
    )
    .max(31),
  products: z.array(analyticsProductSchema).max(10),
  customers: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-f0-9]{64}$/),
        name: z.string().max(120),
        phoneMasked: z.string().max(30),
        orders: count,
        total: count,
        lastPurchase: z.iso.datetime(),
      }),
    )
    .max(10),
  couriers: z
    .array(
      z.strictObject({
        id: uuid.nullable(),
        name: z.string().max(120),
        deliveries: count,
        avgMinutes: duration,
      }),
    )
    .max(10),
  busyHours: z
    .array(z.strictObject({ hour: z.number().int().min(0).max(23), orders: count }))
    .max(24),
  weekdays: z
    .array(z.strictObject({ day: z.number().int().min(0).max(6), orders: count }))
    .max(7),
  paymentMethods: z
    .array(z.strictObject({ name: z.string().max(120), orders: count }))
    .max(20),
  promotions: z
    .array(z.strictObject({ name: z.string().max(120), orders: count, discounts: count }))
    .max(10),
})
export const bestSellersSchema = z.strictObject({
  productIds: z.array(uuid).max(20),
  days: z.literal(30),
})
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>
export type AnalyticsMetrics = z.infer<typeof analyticsMetricsSchema>
export type BestSellers = z.infer<typeof bestSellersSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
