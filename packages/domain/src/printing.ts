import type { Role } from "./permissions.js"

export const receiptKinds = ["ORDER", "KITCHEN", "DELIVERY", "PAYMENT"] as const
export type ReceiptKind = (typeof receiptKinds)[number]
export const receiptSections = [
  "store",
  "customer",
  "items",
  "totals",
  "payment",
  "notes",
] as const
export type ReceiptSection = (typeof receiptSections)[number]
export type ReceiptBlock =
  | { type: "text"; data: { text: string; align: "left" | "center" | "right" } }
  | { type: "logo"; data: { size: "small" | "medium" | "large" } }
  | { type: "section"; data: { section: ReceiptSection } }
  | { type: "divider"; data: Record<string, never> }
export interface ReceiptTemplate {
  blocks: ReceiptBlock[]
}
export interface PrinterProfile {
  id: string
  name: string
  modelId: string
  paperWidthMm: number
  printableWidthMm: number
  marginMm: number
  fontSize: number
  copies: number
  dpi: 180 | 203 | 300
  cut: "NONE" | "PARTIAL" | "FULL"
  feedLines: number
}
export interface PrintingSettings {
  revision: number
  profiles: PrinterProfile[]
  defaults: Record<ReceiptKind, string>
  templates: Record<ReceiptKind, ReceiptTemplate>
  logo: string
}
export const requiredReceiptSections: Record<ReceiptKind, readonly ReceiptSection[]> = {
  ORDER: ["items", "totals"],
  KITCHEN: ["items"],
  DELIVERY: ["items", "totals"],
  PAYMENT: ["payment"],
}
export function canPrintReceipt(role: Role, kind: ReceiptKind): boolean {
  if (role === "OWNER" || role === "MANAGER" || role === "CASHIER") return true
  if (role === "STAFF") return kind !== "PAYMENT"
  if (role === "KITCHEN") return kind === "KITCHEN"
  if (role === "COURIER") return kind === "DELIVERY"
  return false
}
const section = (value: ReceiptSection): ReceiptBlock => ({
  type: "section",
  data: { section: value },
})
export function defaultPrintingSettings(): PrintingSettings {
  const profile = (
    id: string,
    name: string,
    modelId: string,
    paperWidthMm: number,
    printableWidthMm: number,
  ): PrinterProfile => ({
    id,
    name,
    modelId,
    paperWidthMm,
    printableWidthMm,
    marginMm: 2,
    fontSize: 10,
    copies: 1,
    dpi: 203,
    cut: "NONE",
    feedLines: 3,
  })
  const template = (...sections: ReceiptSection[]): ReceiptTemplate => ({
    blocks: [
      { type: "logo", data: { size: "medium" } },
      section("store"),
      ...sections.map(section),
    ],
  })
  return {
    revision: 0,
    profiles: [
      profile("thermal-80", "Térmica 80 mm", "generic-80", 80, 72),
      profile("thermal-58", "Térmica 58 mm", "generic-58", 58, 48),
      {
        ...profile("office-a4", "Impressora A4", "a4", 210, 190),
        marginMm: 10,
        feedLines: 0,
      },
    ],
    defaults: {
      ORDER: "thermal-80",
      KITCHEN: "thermal-80",
      DELIVERY: "thermal-80",
      PAYMENT: "thermal-80",
    },
    templates: {
      ORDER: template("customer", "items", "totals", "notes"),
      KITCHEN: template("items", "notes"),
      DELIVERY: template("customer", "items", "totals", "notes"),
      PAYMENT: template("payment", "totals"),
    },
    logo: "",
  }
}
