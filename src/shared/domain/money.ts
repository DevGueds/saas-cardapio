import { requireValid } from "./failure"

export type Cents = number

export function assertCents(
  value: unknown,
  field: string,
  positive = false,
): asserts value is Cents {
  requireValid(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= (positive ? 1 : 0),

    "Informe um valor monetário válido.",
    field,
  )
}

export function parseMoney(input: string, field = "price", positive = false): Cents {
  requireValid(typeof input === "string", "Informe um valor monetário válido.", field)

  const text = input.trim()

  requireValid(
    /^\d+(?:[.,]\d{1,2})?$/.test(text),
    "Use um valor como 28,90, sem separadores de milhares.",
    field,
  )

  const [whole, fraction = ""] = text.replace(",", ".").split(".")

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))

  assertCents(cents, field, positive)

  return cents
}

export function formatMoney(cents: Cents): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)
}

export function moneyInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}

export function legacyMoney(value: unknown): Cents {
  requireValid(
    typeof value === "number" && Number.isFinite(value) && value >= 0,

    "Valor monetário legado inválido.",
  )

  const cents = Math.round(value * 100)

  requireValid(
    Math.abs(value * 100 - cents) < 0.00001,
    "Valor legado possui mais de duas casas decimais.",
  )

  assertCents(cents, "price")

  return cents
}
