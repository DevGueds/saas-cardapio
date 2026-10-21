import { getDistance } from "geolib"
import { requireValid } from "./failure.js"
import { assertCents } from "./money.js"
import { identifier, record } from "./validation.js"

export interface GeoPoint {
  latitude: number
  longitude: number
}
export interface RadiusBand {
  id: string
  maxMeters: number
  fee: number
}
export interface RadiusDelivery {
  origin: GeoPoint | null
  bands: RadiusBand[]
}
export interface RadiusSnapshot {
  origin: GeoPoint
  distanceMeters: number
  maxMeters: number
  fee: number
}
export function parseGeoPoint(input: unknown): GeoPoint {
  const value = record(input)
  for (const [field, limit] of [
    ["latitude", 90],
    ["longitude", 180],
  ] as const)
    requireValid(
      typeof value[field] === "number" &&
        Number.isFinite(value[field]) &&
        Math.abs(value[field]) <= limit,
      "Marque uma localização válida no mapa.",
      field,
    )
  return {
    latitude: Number((value.latitude as number).toFixed(6)),
    longitude: Number((value.longitude as number).toFixed(6)),
  }
}
export function parseRadiusDelivery(input: unknown): RadiusDelivery {
  const value = record(input)
  requireValid(
    Array.isArray(value.bands) && value.bands.length <= 20,
    "Cadastre até 20 faixas de distância.",
    "bands",
  )
  const bands = (value.bands as unknown[])
    .map((input) => {
      const band = record(input)
      requireValid(
        typeof band.maxMeters === "number" &&
          Number.isSafeInteger(band.maxMeters) &&
          band.maxMeters >= 1 &&
          band.maxMeters <= 100000,
        "Informe um raio entre 0,001 e 100 km.",
        "maxMeters",
      )
      assertCents(band.fee, "fee")
      return {
        id: identifier(band.id),
        maxMeters: band.maxMeters as number,
        fee: band.fee,
      }
    })
    .sort((a, b) => a.maxMeters - b.maxMeters)
  requireValid(
    new Set(bands.map((b) => b.id)).size === bands.length &&
      new Set(bands.map((b) => b.maxMeters)).size === bands.length,
    "Cada faixa precisa de um limite de distância diferente.",
    "bands",
  )
  return { origin: value.origin === null ? null : parseGeoPoint(value.origin), bands }
}
/** Distances are straight-line estimates, rounded to the nearest metre by geolib. */
export function radiusDeliveryQuote(
  settings: RadiusDelivery,
  destination: unknown,
): RadiusSnapshot {
  const policy = parseRadiusDelivery(settings)
  requireValid(!!policy.origin, "A loja precisa configurar seu ponto de saída.", "origin")
  const origin = parseGeoPoint(policy.origin)
  const distanceMeters = getDistance(origin, parseGeoPoint(destination), 1)
  requireValid(
    Number.isSafeInteger(distanceMeters) && distanceMeters >= 0,
    "Não foi possível calcular a distância.",
  )
  const band = policy.bands.find((b) => distanceMeters <= b.maxMeters)
  requireValid(
    !!band,
    "Este ponto está fora do raio de entrega da loja. Escolha outro endereço ou a retirada, se disponível.",
    "destination",
  )
  return { origin, distanceMeters, maxMeters: band!.maxMeters, fee: band!.fee }
}
/** Parse decimal kilometres as integer metres, without floating-point multiplication. */
export function parseKilometers(input: string): number {
  requireValid(
    /^\d+(?:[.,]\d{1,3})?$/.test(input.trim()),
    "Use quilômetros com até três casas decimais, como 2,5.",
    "maxMeters",
  )
  const [whole, fraction = ""] = input.trim().replace(",", ".").split(".")
  const meters = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"))
  requireValid(
    Number.isSafeInteger(meters) && meters >= 1 && meters <= 100000,
    "Informe um raio entre 0,001 e 100 km.",
    "maxMeters",
  )
  return meters
}
