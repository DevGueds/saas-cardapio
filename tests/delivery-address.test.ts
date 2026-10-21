import { describe, it, expect } from "vitest"
import {
  deliveryAddressSchema,
  deliverySchema,
  checkoutSchema,
} from "@cardapio/contracts"
import {
  emptyDeliveryAddress,
  parseDeliveryAddress,
  deliveryAddressLines,
} from "@cardapio/domain/delivery-address"
import { validateCheckout } from "@cardapio/domain/checkout"
import { emptyCommerce } from "@cardapio/domain/commerce"
import { sampleMenu } from "./helpers"
import { sampleAddress } from "./address-fixture"
const details = {
  name: "Cliente Teste",
  phone: "11999999999",
  address: "Texto adulterado",
  deliveryAddress: sampleAddress(),
  notes: "",
  payment: "Pix" as const,
  cashChange: "",
}
const menu = sampleMenu()
const cart = {
  restaurantId: menu.restaurant.id,
  lines: [
    {
      productId: menu.products[0]!.id,
      unitPrice: menu.products[0]!.price,
      quantity: 1,
      note: "",
    },
  ],
}
describe("structured delivery address", () => {
  it.each([
    { street: "Rua" },
    { street: "123" },
    { number: "" },
    { number: "abc" },
    { neighborhood: "" },
    { city: "" },
    { state: "XX" },
    { postalCode: "123" },
    { noNumber: true },
    { noNumber: true, number: "", reference: "x" },
    { kind: "APARTMENT", complement: "" },
    { reference: "line\nline" },
  ])("rejects incomplete or ambiguous delivery details: %j", (change) => {
    expect(
      deliveryAddressSchema.safeParse({ ...sampleAddress(), ...change }).success,
    ).toBe(false)
  })
  it("supports general CEPs, rural properties, apartments and canonical courier lines", () => {
    const address = parseDeliveryAddress({
      ...sampleAddress(),
      street: " Estrada   São João ",
      number: "",
      noNumber: true,
      reference: "Portão azul ao lado da escola",
      postalCode: "01001-000",
      state: "sp",
      kind: "APARTMENT",
      complement: "Bloco B, apartamento 12",
    })
    expect(address.postalCode).toBe("01001000")
    expect(deliveryAddressLines(address)).toEqual([
      "Estrada São João, sem número",
      "Complemento: Bloco B, apartamento 12",
      "Centro · São Paulo / SP",
      "CEP: 01001-000",
      "Referência: Portão azul ao lado da escola",
    ])
    expect(
      deliveryAddressSchema.safeParse({
        ...sampleAddress(),
        postalCode: "",
        number: "123-A",
      }).success,
    ).toBe(true)
  })
  it("rejects legacy free text on new orders but keeps historical orders readable", () => {
    expect(
      deliverySchema.safeParse({ ...details, deliveryAddress: undefined }).success,
    ).toBe(true)
    expect(() =>
      validateCheckout(menu, menu.restaurant.id, menu.revision, cart, {
        ...details,
        deliveryAddress: undefined,
      }),
    ).toThrow("campos do endereço")
    const checked = validateCheckout(
      menu,
      menu.restaurant.id,
      menu.revision,
      cart,
      details,
    )
    expect(checked.customer.address).toBe("Rua São João, 10 · Centro · São Paulo / SP")
    expect(checked.message).not.toContain("Texto adulterado")
  })
  it("requires address region to match the charged zone and strips addresses from pickup", () => {
    const zoned = {
      ...menu,
      commerce: {
        ...emptyCommerce(),
        delivery: {
          ...emptyCommerce().delivery,
          mode: "ZONES" as const,
          pickupEnabled: true,
          zones: [
            {
              id: "zone",
              state: "SP",
              city: "São Paulo",
              neighborhood: "Centro",
              fee: 500,
              etaMin: 20,
              etaMax: 40,
              active: true,
              latitude: null,
              longitude: null,
            },
          ],
        },
      },
    }
    const options = { fulfillment: { mode: "DELIVERY" as const, zoneId: "zone" } }
    expect(() =>
      validateCheckout(
        zoned,
        menu.restaurant.id,
        menu.revision,
        cart,
        {
          ...details,
          deliveryAddress: { ...sampleAddress(), neighborhood: "Outro bairro" },
        },
        options,
      ),
    ).toThrow("região de entrega")
    expect(
      validateCheckout(zoned, menu.restaurant.id, menu.revision, cart, details, options)
        .quote.deliveryFee,
    ).toBe(500)
    const pickup = validateCheckout(
      zoned,
      menu.restaurant.id,
      menu.revision,
      cart,
      { ...details, deliveryAddress: emptyDeliveryAddress() },
      { fulfillment: { mode: "PICKUP" } },
    )
    expect(pickup.customer.deliveryAddress).toBeUndefined()
    expect(pickup.customer.address).toBe("Retirada na loja")
  })
  it("exposes the exact invalid field at the HTTP boundary", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const result = checkoutSchema.safeParse({
      expectedRevision: 0,
      cart: {
        restaurantId: id,
        lines: [{ productId: id, unitPrice: 100, quantity: 1, note: "" }],
      },
      details: { ...details, deliveryAddress: { ...sampleAddress(), number: "" } },
    })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
        "details.deliveryAddress.number",
      )
  })
})
