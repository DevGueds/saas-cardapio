import { assertCents, type Cents } from "../../../shared/domain/money"

import {
  boolean,
  brazilianPhone,
  identifier,
  imageReference,
  record,
  text,
} from "../../../shared/domain/validation"

export type Restaurant = Readonly<{
  id: string
  slug: string
  name: string
  description: string

  logoUrl: string
  coverUrl: string
  whatsapp: string
  whatsappConfigured: boolean

  deliveryFee: Cents
  minOrder: Cents
  address: string
  isOpen: boolean
  eta: string
}>

export function parseRestaurant(input: unknown): Restaurant {
  const data = record(input)

  assertCents(data.deliveryFee, "deliveryFee")

  assertCents(data.minOrder, "minOrder")

  const whatsappConfigured = boolean(data.whatsappConfigured, "whatsappConfigured")

  const whatsapp = text(data.whatsapp, "whatsapp", 30)

  if (whatsappConfigured) brazilianPhone(whatsapp, "whatsapp")

  return {
    id: identifier(data.id),
    slug: identifier(data.slug, "slug"),
    name: text(data.name, "name", 120, true),

    description: text(data.description, "description", 1000),
    logoUrl: imageReference(data.logoUrl, "logoUrl"),

    coverUrl: imageReference(data.coverUrl, "coverUrl"),
    whatsapp,
    whatsappConfigured,

    deliveryFee: data.deliveryFee,
    minOrder: data.minOrder,
    address: text(data.address, "address", 500),

    isOpen: boolean(data.isOpen, "isOpen"),
    eta: text(data.eta, "eta", 80, true),
  }
}
