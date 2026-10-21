import { describe, expect, it } from "vitest"
import {
  parseGeoPoint,
  parseKilometers,
  parseRadiusDelivery,
  radiusDeliveryQuote,
} from "@cardapio/domain/delivery-radius"
import { emptyCommerce, parseDelivery } from "@cardapio/domain/commerce"
import { quoteOrder } from "@cardapio/domain/quote"
import { checkoutOptionsSchema } from "@cardapio/contracts"
import { sampleMenu } from "./helpers"
const origin = { latitude: 0, longitude: 0 }
const radius = {
  origin,
  bands: [
    { id: "near", maxMeters: 1113, fee: 101 },
    { id: "far", maxMeters: 2226, fee: 202 },
  ],
}
describe("frete por raio", () => {
  it("uses integer metres and an inclusive upper bound, never accumulates fees", () => {
    expect(radiusDeliveryQuote(radius, origin)).toMatchObject({
      distanceMeters: 0,
      fee: 101,
    })
    expect(radiusDeliveryQuote(radius, { latitude: 0, longitude: 0.01 })).toMatchObject({
      distanceMeters: 1113,
      maxMeters: 1113,
      fee: 101,
    })
    expect(
      radiusDeliveryQuote(radius, { latitude: 0, longitude: 0.01001 }),
    ).toMatchObject({ distanceMeters: 1114, fee: 202 })
    expect(() => radiusDeliveryQuote(radius, { latitude: 0, longitude: 0.1 })).toThrow(
      /fora do raio/,
    )
  })
  it("sorts bands, allows free delivery and rejects duplicate, fractional and oversized limits", () => {
    expect(
      parseRadiusDelivery({ ...radius, bands: [...radius.bands].reverse() }),
    ).toEqual(radius)
    expect(
      radiusDeliveryQuote(
        { origin, bands: [{ id: "free", maxMeters: 1000, fee: 0 }] },
        origin,
      ).fee,
    ).toBe(0)
    for (const bands of [
      [radius.bands[0], radius.bands[0]],
      [{ id: "a", maxMeters: 1.5, fee: 100 }],
      [{ id: "a", maxMeters: 100001, fee: 100 }],
      [{ id: "a", maxMeters: 1000, fee: 0.1 }],
    ])
      expect(() => parseRadiusDelivery({ origin, bands })).toThrow()
    expect(() => parseDelivery({ ...emptyCommerce().delivery, mode: "RADIUS" })).toThrow()
    expect(() =>
      parseDelivery({
        ...emptyCommerce().delivery,
        mode: "RADIUS",
        radius: { origin: null, bands: [] },
      }),
    ).toThrow()
  })
  it("rejects missing or invalid coordinates and parses kilometres without monetary rounding", () => {
    for (const value of [
      null,
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: Infinity },
      { latitude: "0", longitude: 0 },
    ])
      expect(() => parseGeoPoint(value)).toThrow()
    expect(parseGeoPoint({ latitude: -23.1234567, longitude: -46.1234567 })).toEqual({
      latitude: -23.123457,
      longitude: -46.123457,
    })
    expect(parseKilometers("0,001")).toBe(1)
    expect(parseKilometers("2.345")).toBe(2345)
    expect(parseKilometers("100")).toBe(100000)
    for (const value of ["0", "2,3456", "1e2", "100,001", "-1", ""])
      expect(() => parseKilometers(value)).toThrow()
  })
  it("server quote derives fees, preserves integer totals and rejects obsolete totals", () => {
    const original = sampleMenu(),
      product = original.products[0]!
    const menu = {
      ...original,
      commerce: {
        ...emptyCommerce(),
        delivery: {
          ...emptyCommerce().delivery,
          pickupEnabled: true,
          mode: "RADIUS" as const,
          radius,
        },
      },
    }
    const cart = {
      restaurantId: menu.restaurant.id,
      lines: [{ productId: product.id, quantity: 3, unitPrice: product.price, note: "" }],
    }
    const quote = quoteOrder(menu, cart, {
      fulfillment: { mode: "DELIVERY", destination: { latitude: 0, longitude: 0.01 } },
    })
    expect(quote.total).toBe(product.price * 3 + 101)
    expect(quote.fulfillment.radius).toEqual({
      origin,
      distanceMeters: 1113,
      maxMeters: 1113,
      fee: 101,
    })
    expect(() =>
      quoteOrder(menu, cart, {
        fulfillment: { mode: "DELIVERY", destination: { latitude: 0, longitude: 0.02 } },
        expectedTotal: quote.total,
      }),
    ).toThrow(/total mudou/)
    expect(() => quoteOrder(menu, cart, { fulfillment: { mode: "DELIVERY" } })).toThrow(
      /ponto/,
    )
    expect(() =>
      quoteOrder(menu, cart, { fulfillment: { mode: "PICKUP", destination: origin } }),
    ).toThrow()
    expect(quoteOrder(menu, cart, { fulfillment: { mode: "PICKUP" } }).deliveryFee).toBe(
      0,
    )
    expect(
      checkoutOptionsSchema.safeParse({
        fulfillment: {
          mode: "DELIVERY",
          destination: origin,
          radius: { fee: 0, distanceMeters: 0 },
        },
      }).success,
    ).toBe(false)
    // Location follows the cart's selected mode; a stale neighbourhood is never priced as a radius.
    expect(() =>
      quoteOrder(menu, cart, {
        fulfillment: { mode: "DELIVERY", zoneId: "old", destination: origin },
      }),
    ).toThrow()
  })
})
