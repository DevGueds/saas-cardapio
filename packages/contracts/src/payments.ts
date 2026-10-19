import { z } from "zod"
import { uuid, cents } from "./common.js"
import { moneyField, textField } from "./fields.js"

export const paymentMethodSchema = z.enum(["PIX", "CASH", "DEBIT", "CREDIT", "OTHER"])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export const paymentInputSchema = z
  .strictObject({
    requestId: uuid,
    orderId: uuid.nullable(),
    expectedPaid: cents,
    amount: moneyField(true),
    method: paymentMethodSchema,
    description: textField(160),
  })
  .superRefine((value, context) => {
    if (!value.orderId && !value.description.trim())
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o recebimento avulso.",
      })
    if (!value.orderId && value.expectedPaid !== 0)
      context.addIssue({
        code: "custom",
        path: ["expectedPaid"],
        message: "Saldo inválido para recebimento avulso.",
      })
  })
export type PaymentInput = z.infer<typeof paymentInputSchema>
export const reversalSchema = z.strictObject({
  reason: textField(300, true).min(5, "Explique o motivo com pelo menos 5 caracteres."),
})
export const paymentSchema = z.strictObject({
  id: uuid,
  orderId: uuid.nullable(),
  amount: cents.positive(),
  method: paymentMethodSchema,
  description: z.string().max(160),
  createdAt: z.iso.datetime(),
  recordedBy: uuid,
  reversedAt: z.iso.datetime().nullable(),
  reversedBy: uuid.nullable(),
  reversalReason: z.string().max(300).nullable(),
})
export type PaymentView = z.infer<typeof paymentSchema>
export const paymentPageSchema = z.strictObject({
  items: z.array(paymentSchema).max(100),
  nextCursor: uuid.nullable(),
})
export type PaymentPage = z.infer<typeof paymentPageSchema>
export const orderBalanceSchema = z.strictObject({
  orderId: uuid,
  total: cents,
  paid: cents,
  outstanding: cents,
  cancelled: z.boolean(),
  payments: z.array(paymentSchema),
})
export type OrderBalance = z.infer<typeof orderBalanceSchema>
export const reportRangeSchema = z
  .strictObject({ from: z.iso.datetime(), to: z.iso.datetime() })
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 31 * 86400000,
    { message: "Selecione um período de até 31 dias, com início anterior ao fim." },
  )
export type ReportRange = z.infer<typeof reportRangeSchema>
const total = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const reportOrderSchema = z.strictObject({
  id: uuid,
  createdAt: z.iso.datetime(),
  status: z.enum([
    "NEW",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ]),
  subtotal: cents,
  discount: cents,
  deliveryFee: cents,
  total: cents,
  paid: cents,
  fulfillment: z.enum(["DELIVERY", "PICKUP"]),
})
export type ReportOrder = z.infer<typeof reportOrderSchema>
export const financialReportSchema = z.strictObject({
  range: reportRangeSchema,
  generatedAt: z.iso.datetime(),
  orders: z.array(reportOrderSchema).max(5000),
  payments: z.array(paymentSchema).max(5000),
  summary: z.strictObject({
    orders: total,
    cancelled: total,
    sales: total,
    discounts: total,
    deliveryFees: total,
    outstanding: total,
    received: total,
    reversed: total,
    netReceived: z
      .number()
      .int()
      .min(-Number.MAX_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER),
  }),
  methods: z.array(
    z.strictObject({ method: paymentMethodSchema, received: total, reversed: total }),
  ),
  daily: z.array(z.strictObject({ day: z.iso.date(), orders: total, sales: total })),
})
export type FinancialReport = z.infer<typeof financialReportSchema>
