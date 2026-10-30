import { currentLegalAcceptance } from "@cardapio/contracts"
import { sampleAddress } from "./address-fixture"
import { describe, it, expect } from "vitest"
import {
  emailField,
  personNameField,
  phoneField,
  optionalPhoneField,
  moneyField,
  passwordField,
  postalCodeField,
  couponField,
  coordinateField,
  imageUploadSchema,
  checkoutSchema,
  registrationSchema,
  promotionSchema,
  zoneSchema,
  validationMessage,
} from "@cardapio/contracts"
import { formatField } from "../src/shared/presentation/form-validation/field-formatters"
import { checkoutDraftSchema } from "../src/modules/checkout/application/drafts"
const id = "00000000-0000-4000-8000-000000000001"
describe("shared Zod input contracts", () => {
  it("preserves Unicode names, apostrophes, hyphens and single-word names", () => {
    for (const name of ["Conceição", "João D’Ávila", "Ana-Maria", "李明", "O'Connor"])
      expect(personNameField.parse(name)).toBe(name)
    expect(personNameField.parse("  João  José  ")).toBe("João José")
    for (const name of ["", "  ", "12345", "Cliente 123", "<script>"])
      expect(personNameField.safeParse(name).success).toBe(false)
  })
  it("normalizes e-mail before validating without removing embedded invalid characters", () => {
    expect(emailField.parse("  JOAO+loja@EXEMPLO.COM  ")).toBe("joao+loja@exemplo.com")
    for (const email of ["nome", "a@", "a b@exemplo.com", "a..b@exemplo.com"])
      expect(emailField.safeParse(email).success).toBe(false)
    expect(
      registrationSchema.parse({
        legalAcceptance: currentLegalAcceptance,
        name: "João",
        email: " JOAO@EXEMPLO.COM ",
        password: "M7!qR2@x",
        restaurantName: "Açaí 10",
        slug: "acai-10",
      }).email,
    ).toBe("joao@exemplo.com")
  })
  it("accepts national and +55 mobile/landline numbers with valid DDD", () => {
    for (const phone of [
      "11987654321",
      "(11) 98765-4321",
      "+55 (11) 98765-4321",
      "5511987654321",
    ])
      expect(phoneField.parse(phone)).toBe("5511987654321")
    expect(phoneField.parse("(55) 3333-4444")).toBe("555533334444")
    expect(optionalPhoneField.parse(" ")).toBe("")
    const invalidOptionalPhone = optionalPhoneField.safeParse("20987654321")
    if (!invalidOptionalPhone.success)
      expect(invalidOptionalPhone.error.issues[0]?.message).toContain(
        "DDD brasileiro válido",
      )
    for (const phone of [
      "20987654321",
      "1191234567",
      "119876543210",
      "11987654321abc",
      "+1 (11) 98765-4321",
    ])
      expect(phoneField.safeParse(phone).success).toBe(false)
  })
  it("accepts decimal dot/comma and rejects residual text, exponents and thousands", () => {
    for (const value of ["28.90", "28,90", "1", "1,2"])
      expect(moneyField(true).safeParse(value).success).toBe(true)
    for (const value of [
      "1,23abc",
      "Infinity",
      "1e2",
      "1.000,00",
      "28.901",
      "-1",
      "0",
      "",
    ])
      expect(moneyField(true).safeParse(value).success).toBe(false)
    expect(moneyField().safeParse("0").success).toBe(true)
    expect(moneyField(true, true).safeParse("").success).toBe(true)
  })
  it("never trims or truncates passwords and counts Unicode code points", () => {
    expect(passwordField.parse(" Frase-9!  ")).toBe(" Frase-9!  ")
    expect(passwordField.safeParse("🍕".repeat(8)).success).toBe(false)
    expect(passwordField.safeParse("a".repeat(129)).success).toBe(false)
    expect(passwordField.safeParse("1234567").success).toBe(false)
  })
  it("validates postal codes, coupons, coordinates and image metadata", () => {
    expect(postalCodeField.safeParse("01001-000").success).toBe(true)
    expect(postalCodeField.safeParse("01001abc").success).toBe(false)
    expect(couponField.parse(" bemvindo10 ")).toBe("BEMVINDO10")
    expect(couponField.safeParse("A!").success).toBe(false)
    expect(coordinateField(90).safeParse("-23,5").success).toBe(true)
    for (const value of ["91", "Infinity", "1e1"])
      expect(coordinateField(90).safeParse(value).success).toBe(false)
    expect(
      imageUploadSchema.safeParse({ type: "image/svg+xml", size: 100 }).success,
    ).toBe(false)
    expect(
      imageUploadSchema.safeParse({ type: "image/png", size: 5 * 1024 * 1024 + 1 })
        .success,
    ).toBe(false)
  })
  it("validates promotion dates/percentages and paired coordinates/ETAs in API contracts", () => {
    const promotion = {
      id,
      name: "Oferta",
      code: "",
      kind: "PERCENT",
      value: 101,
      minSubtotal: 0,
      maxDiscount: 0,
      active: true,
      includeCombos: false,
      startsAt: "2026-10-10T00:00:00Z",
      endsAt: "2026-10-09T00:00:00Z",
      maxUses: 0,
    }
    const result = promotionSchema.safeParse(promotion)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues.map((i) => i.path.join("."))).toEqual(
        expect.arrayContaining(["value", "endsAt"]),
      )
    const zone = {
      id,
      state: "SP",
      city: "São Paulo",
      neighborhood: "Sé",
      fee: 0,
      etaMin: 60,
      etaMax: 30,
      active: true,
      latitude: -23,
      longitude: null,
    }
    const parsed = zoneSchema.safeParse(zone)
    expect(parsed.success).toBe(false)
    if (!parsed.success)
      expect(parsed.error.issues.map((i) => i.path.join("."))).toEqual(
        expect.arrayContaining(["etaMax", "longitude"]),
      )
  })
  it("requires delivery address only for delivery, and never accepts incomplete persisted drafts as checkout", () => {
    const draft = {
      details: {
        name: "João",
        phone: "11",
        address: "",
        notes: "",
        payment: "Pix",
        cashChange: "",
      },
      mode: "DELIVERY",
      zoneId: "",
      couponCode: "",
      cep: "010",
    }
    expect(checkoutDraftSchema.safeParse(draft).success).toBe(true)
    const input = {
      expectedRevision: 1,
      cart: {
        restaurantId: id,
        lines: [{ productId: id, quantity: 1, unitPrice: 100, note: "" }],
      },
      details: { ...draft.details, phone: "11987654321" },
    }
    expect(checkoutSchema.safeParse(input).success).toBe(false)
    expect(
      checkoutSchema.safeParse({
        ...input,
        details: {
          ...input.details,
          address: "Rua São João, 10",
          deliveryAddress: sampleAddress(),
          cashChange: "inválido",
          payment: "Pix",
        },
      }).success,
    ).toBe(true)
    expect(
      checkoutSchema.safeParse({
        ...input,
        details: {
          ...input.details,
          address: "Rua São João, 10",
          deliveryAddress: sampleAddress(),
          cashChange: "inválido",
          payment: "Dinheiro",
        },
      }).success,
    ).toBe(false)
    expect(
      checkoutSchema.safeParse({ ...input, options: { fulfillment: { mode: "PICKUP" } } })
        .success,
    ).toBe(true)
  })
  it("does not reflect arbitrary Zod enum messages into API errors", () => {
    expect(
      validationMessage({ message: 'Invalid option: expected one of "private"' }),
    ).not.toContain("private")
  })
})
describe("non-destructive input formatters", () => {
  it("formats common Brazilian values", () => {
    expect(formatField("11987654321", "phone")).toBe("(11) 98765-4321")
    expect(formatField("+5511987654321", "phone")).toBe("+55 (11) 98765-4321")
    expect(formatField("5533334444", "phone")).toBe("(55) 3333-4444")
    expect(formatField("01001000", "cep")).toBe("01001-000")
    expect(formatField("28.9", "money")).toBe("28,90")
    expect(formatField("  Conceição  D’Ávila  ", "name")).toBe("Conceição D’Ávila")
    expect(formatField("Açaí da Praça", "slug")).toBe("acai-da-praca")
    expect(formatField("-23,5", "coordinate")).toBe("-23.5")
  })
  it("keeps invalid or unfinished pasted values visible for correction", () => {
    for (const value of ["1,23abc", "1.234,56", "Infinity", "1,"])
      expect(formatField(value, "money")).toBe(value)
    for (const value of ["11987654321abc", "119876543210", "+1 (11) 98765-4321", "11"])
      expect(formatField(value, "phone")).toBe(value)
  })
})
