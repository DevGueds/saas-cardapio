import { requireValid } from "./failure.js"
import { boolean, normalizeName, record, text } from "./validation.js"

export const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const
export const addressKinds = ["HOUSE", "APARTMENT", "BUSINESS", "OTHER"] as const
export interface DeliveryAddress {
  street: string
  number: string
  noNumber: boolean
  complement: string
  neighborhood: string
  city: string
  state: string
  postalCode: string
  reference: string
  kind: (typeof addressKinds)[number]
}
export const emptyDeliveryAddress = (): DeliveryAddress => ({
  street: "",
  number: "",
  noNumber: false,
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  reference: "",
  kind: "HOUSE",
})
export const addressTextLimits = {
  street: 200,
  number: 20,
  complement: 120,
  neighborhood: 120,
  city: 120,
  state: 2,
  postalCode: 9,
  reference: 160,
} as const
export type AddressTextField = keyof typeof addressTextLimits
export function parseAddressText(
  field: AddressTextField,
  input: unknown,
  context?: Pick<DeliveryAddress, "noNumber" | "kind">,
): string {
  const value = text(input, field, addressTextLimits[field])
    .normalize("NFC")
    .replace(/\s+/g, " ")
  requireValid(
    !/[\u0000-\u001F\u007F]/u.test(String(input)),
    "Use apenas texto em uma linha.",
    field,
  )
  if (field === "street") {
    requireValid(
      value.length >= 3 && /\p{L}/u.test(value),
      "Informe o nome da rua, avenida ou estrada.",
      field,
    )
    requireValid(
      !["rua", "avenida", "av", "estrada", "rodovia", "travessa", "praca"].includes(
        normalizeName(value).replace(/\.$/, ""),
      ),
      "Complete o nome da rua, avenida ou estrada.",
      field,
    )
  }
  if (field === "city" || field === "neighborhood")
    requireValid(
      value.length >= 2 && /\p{L}/u.test(value),
      field === "city" ? "Informe a cidade da entrega." : "Informe o bairro da entrega.",
      field,
    )
  if (field === "state") {
    const state = value.toUpperCase()
    requireValid(
      (brazilianStates as readonly string[]).includes(state),
      "Selecione a UF da entrega.",
      field,
    )
    return state
  }
  if (field === "postalCode") {
    requireValid(
      !value || /^\d{5}-?\d{3}$/.test(value),
      "Informe os 8 números do CEP ou deixe vazio.",
      field,
    )
    return value.replace("-", "")
  }
  if (field === "number") {
    requireValid(
      !value || /^\d+[\p{L}\d /.-]*$/u.test(value),
      "Informe o número, como 123 ou 123-A. Se não existir, marque Sem número.",
      field,
    )
    requireValid(
      !context || context.noNumber || !!value,
      "Informe o número do imóvel ou marque Sem número.",
      field,
    )
    requireValid(
      !context?.noNumber || !value,
      "Desmarque Sem número para informar um número.",
      field,
    )
  }
  if (field === "complement" && context?.kind === "APARTMENT")
    requireValid(
      value.length >= 2 && /[\p{L}\d]/u.test(value),
      "Informe o apartamento, bloco ou unidade do condomínio.",
      field,
    )
  if (field === "reference" && context?.noNumber)
    requireValid(
      value.length >= 5 && /\p{L}/u.test(value),
      "Sem número: informe uma referência que identifique a entrada do imóvel.",
      field,
    )
  return value
}
export function parseDeliveryAddress(input: unknown): DeliveryAddress {
  requireValid(
    !!input && typeof input === "object",
    "Preencha os campos do endereço de entrega.",
    "deliveryAddress",
  )
  const value = record(input)
  const noNumber = boolean(value.noNumber, "noNumber")
  requireValid(
    (addressKinds as readonly unknown[]).includes(value.kind),
    "Selecione o tipo de local.",
    "kind",
  )
  const context = { noNumber, kind: value.kind as DeliveryAddress["kind"] }
  return {
    ...context,
    street: parseAddressText("street", value.street, context),
    number: parseAddressText("number", value.number, context),
    complement: parseAddressText("complement", value.complement, context),
    neighborhood: parseAddressText("neighborhood", value.neighborhood, context),
    city: parseAddressText("city", value.city, context),
    state: parseAddressText("state", value.state, context),
    postalCode: parseAddressText("postalCode", value.postalCode, context),
    reference: parseAddressText("reference", value.reference, context),
  }
}
export function deliveryAddressLines(address: DeliveryAddress): string[] {
  return [
    `${address.street}, ${address.noNumber ? "sem número" : address.number}`,
    ...(address.complement ? [`Complemento: ${address.complement}`] : []),
    `${address.neighborhood} · ${address.city} / ${address.state}`,
    ...(address.postalCode
      ? [`CEP: ${address.postalCode.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`]
      : []),
    ...(address.reference ? [`Referência: ${address.reference}`] : []),
  ]
}
/** Includes all delivery instructions so a changed address cannot reuse a confirmed map point. */
export function deliveryAddressSignature(address: DeliveryAddress | undefined): string {
  return address ? JSON.stringify(address) : ""
}
