import { z } from "zod"
import {
  receiptKinds,
  receiptSections,
  requiredReceiptSections,
} from "@cardapio/domain/printing"
import { uuid, revision, cents } from "./common.js"
import { paymentMethodSchema } from "./payments.js"

export type {
  ReceiptKind,
  ReceiptSection,
  ReceiptBlock,
  ReceiptTemplate,
  PrinterProfile,
  PrintingSettings,
} from "@cardapio/domain/printing"
export const receiptKindSchema = z.enum(receiptKinds)
export const receiptSectionSchema = z.enum(receiptSections)
const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (value) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
      "Use somente texto, sem HTML ou caracteres de controle.",
    )
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/)
export const receiptBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("text"),
    data: z.strictObject({
      text: plain(500),
      align: z.enum(["left", "center", "right"]),
    }),
  }),
  z.strictObject({
    type: z.literal("logo"),
    data: z.strictObject({ size: z.enum(["small", "medium", "large"]) }),
  }),
  z.strictObject({
    type: z.literal("section"),
    data: z.strictObject({ section: receiptSectionSchema }),
  }),
  z.strictObject({ type: z.literal("divider"), data: z.strictObject({}) }),
])
export const receiptTemplateSchema = z.strictObject({
  blocks: z.array(receiptBlockSchema).min(1).max(32),
})
export const printingLogoSchema = z
  .string()
  .max(200_000)
  .refine(
    (value) =>
      value === "" ||
      /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(value),
    "Use uma imagem PNG de até 200 KB codificados.",
  )
export const printerProfileSchema = z
  .strictObject({
    id: key,
    name: plain(80).trim().min(1),
    modelId: key,
    paperWidthMm: z.number().int().min(40).max(210),
    printableWidthMm: z.number().min(32).max(210),
    marginMm: z.number().min(0).max(15),
    fontSize: z.number().min(8).max(18),
    copies: z.number().int().min(1).max(5),
    dpi: z.union([z.literal(180), z.literal(203), z.literal(300)]),
    cut: z.enum(["NONE", "PARTIAL", "FULL"]),
    feedLines: z.number().int().min(0).max(8),
  })
  .refine((v) => v.printableWidthMm + v.marginMm * 2 <= v.paperWidthMm, {
    path: ["printableWidthMm"],
    message: "A largura útil e as margens devem caber no papel.",
  })
const fields = {
  profiles: z.array(printerProfileSchema).min(1).max(8),
  defaults: z.strictObject({ ORDER: key, KITCHEN: key, DELIVERY: key, PAYMENT: key }),
  templates: z.strictObject({
    ORDER: receiptTemplateSchema,
    KITCHEN: receiptTemplateSchema,
    DELIVERY: receiptTemplateSchema,
    PAYMENT: receiptTemplateSchema,
  }),
  logo: printingLogoSchema,
}
function settingsRules(
  value: z.infer<ReturnType<typeof baseSettings>>,
  ctx: z.RefinementCtx,
) {
  const ids = new Set(value.profiles.map((p) => p.id))
  if (ids.size !== value.profiles.length)
    ctx.addIssue({
      code: "custom",
      path: ["profiles"],
      message: "Cada perfil precisa de um identificador diferente.",
    })
  for (const kind of receiptKinds) {
    if (!ids.has(value.defaults[kind]))
      ctx.addIssue({
        code: "custom",
        path: ["defaults", kind],
        message: "Selecione um perfil existente.",
      })
    const sections = value.templates[kind].blocks
      .filter((b) => b.type === "section")
      .map((b) => b.data.section)
    if (new Set(sections).size !== sections.length)
      ctx.addIssue({
        code: "custom",
        path: ["templates", kind],
        message: "Não repita seções do documento.",
      })
    for (const section of requiredReceiptSections[kind])
      if (!sections.includes(section))
        ctx.addIssue({
          code: "custom",
          path: ["templates", kind],
          message: `Mantenha a seção obrigatória: ${section}.`,
        })
  }
}
function baseSettings() {
  return z.strictObject(fields)
}
export const printingSettingsSchema = baseSettings()
  .extend({ revision })
  .superRefine(settingsRules)
export const updatePrintingSettingsSchema = baseSettings()
  .extend({ expectedRevision: revision })
  .superRefine(settingsRules)
export type UpdatePrintingSettings = z.infer<typeof updatePrintingSettingsSchema>

const receiptTotalsSchema = z.strictObject({
  subtotal: cents,
  discount: cents,
  deliveryFee: cents,
  total: cents,
  paid: cents,
  outstanding: cents,
})
export const receiptSnapshotSchema = z
  .strictObject({
    kind: receiptKindSchema,
    generatedAt: z.iso.datetime(),
    restaurant: z.strictObject({
      id: uuid,
      name: z.string().max(120),
      address: z.string().max(500),
      phone: z.string().max(30),
      logo: printingLogoSchema,
    }),
    source: z.strictObject({
      orderId: uuid.nullable(),
      paymentId: uuid.nullable(),
      orderRevision: revision.nullable(),
      createdAt: z.iso.datetime(),
      status: z
        .enum(["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"])
        .nullable(),
      paymentStatus: z.enum(["VALID", "REVERSED"]).nullable(),
    }),
    customer: z
      .strictObject({
        name: z.string().max(120),
        phone: z.string().max(30),
        address: z.string().max(1500),
        notes: z.string().max(500),
        payment: z.string().max(40),
        cashChange: z.string().max(30),
      })
      .nullable(),
    items: z
      .array(
        z.strictObject({
          name: z.string().max(120),
          quantity: z.number().int().min(1).max(999),
          unitPrice: cents.nullable(),
          total: cents.nullable(),
          components: z.array(z.string().max(500)).max(100),
          note: z.string().max(500),
        }),
      )
      .max(100),
    totals: receiptTotalsSchema.nullable(),
    payment: z
      .strictObject({
        amount: cents.positive(),
        method: paymentMethodSchema,
        description: z.string().max(160),
        createdAt: z.iso.datetime(),
        reversedAt: z.iso.datetime().nullable(),
        reversalReason: z.string().max(300).nullable(),
      })
      .nullable(),
    notes: z.string().max(500),
  })
  .superRefine((value, context) => {
    const invalid = (message: string) => context.addIssue({ code: "custom", message })
    if (value.kind === "PAYMENT") {
      if (!value.payment || !value.source.paymentId || value.items.length)
        invalid("Recebimento sem origem válida.")
      if (
        value.payment &&
        (value.source.createdAt !== value.payment.createdAt ||
          value.source.paymentStatus !==
            (value.payment.reversedAt ? "REVERSED" : "VALID"))
      )
        invalid("Situação do recebimento inconsistente.")
    } else if (
      !value.source.orderId ||
      value.source.paymentId ||
      value.payment ||
      value.source.paymentStatus ||
      !value.items.length
    )
      invalid("Pedido sem origem válida.")
    if (value.kind === "KITCHEN") {
      if (
        value.customer ||
        value.totals ||
        value.notes ||
        value.items.some((item) => item.unitPrice !== null || item.total !== null)
      )
        invalid("Documento de preparo contém dados restritos.")
    } else {
      for (const item of value.items)
        if (item.unitPrice === null || item.total !== item.unitPrice * item.quantity)
          invalid("Valores dos itens inconsistentes.")
    }
    if (value.totals) {
      const totals = value.totals
      if (
        totals.subtotal + totals.deliveryFee - totals.discount !== totals.total ||
        totals.paid > totals.total ||
        totals.outstanding !==
          (value.source.status === "CANCELLED" ? 0 : totals.total - totals.paid)
      )
        invalid("Totais do documento inconsistentes.")
      if (
        value.kind !== "PAYMENT" &&
        value.items.reduce((sum, item) => sum + (item.total ?? 0), 0) !== totals.subtotal
      )
        invalid("Subtotal do documento inconsistente.")
    }
  })
export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>
export const receiptDocumentSchema = z.strictObject({
  snapshot: receiptSnapshotSchema,
  profile: printerProfileSchema,
  template: receiptTemplateSchema,
})
export type ReceiptDocument = z.infer<typeof receiptDocumentSchema>
