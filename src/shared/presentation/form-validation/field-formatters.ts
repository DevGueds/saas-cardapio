import { moneyField } from "@cardapio/contracts"
import { moneyInput, parseMoney } from "@cardapio/domain/money"
export type FieldFormat =
  "phone" | "cep" | "money" | "name" | "email" | "slug" | "coupon" | "coordinate"

// Format only recognizable syntax. Invalid pasted text must not become valid
// by silently removing letters, extra digits, separators or currency symbols.
export function formatField(value: string, format?: FieldFormat): string {
  if (!format || !value) return value
  if (format === "name") return value.normalize("NFC").trim().replace(/\s+/g, " ")
  if (format === "email") return value.trim().toLowerCase()
  if (format === "slug")
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
  if (format === "coupon") return value.trim().toUpperCase()
  if (format === "coordinate") return value.trim().replace(",", ".")
  if (format === "money")
    return moneyField().safeParse(value).success ? moneyInput(parseMoney(value)) : value
  if (format === "cep") {
    if (!/^[\d-]+$/.test(value)) return value
    const digits = value.replace(/-/g, "")
    return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value
  }
  if (!/^[+\d\s().-]+$/.test(value)) return value
  let digits = value.replace(/\D/g, "")
  const international = digits.length >= 12 && digits.startsWith("55")
  if (international) digits = digits.slice(2)
  if (
    (value.trim().startsWith("+") && !international) ||
    ![10, 11].includes(digits.length)
  )
    return value
  const prefix = international ? "+55 " : ""
  const split = digits.length === 11 ? 7 : 6
  return `${prefix}(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}
