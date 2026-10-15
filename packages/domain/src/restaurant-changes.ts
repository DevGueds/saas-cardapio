import { parseMoney } from "./money.js"
import { brazilianPhone, text } from "./validation.js"
import { parseRestaurant } from "./restaurant.js"
import type { MenuDocument } from "./menu-document.js"
export interface RestaurantSettingsInput {
  name: string
  description: string
  whatsapp: string
  address: string
  logoUrl: string
  coverUrl: string
  deliveryFee: string
  minOrder: string
  eta: string
}
export function updateRestaurant(
  current: MenuDocument,
  input: RestaurantSettingsInput,
): MenuDocument {
  const whatsapp = text(input.whatsapp, "whatsapp", 30)
  const restaurant = parseRestaurant({
    ...current.restaurant,
    ...input,
    whatsapp: whatsapp ? brazilianPhone(whatsapp, "whatsapp") : "",
    whatsappConfigured: whatsapp !== "",
    deliveryFee: parseMoney(input.deliveryFee, "deliveryFee"),
    minOrder: parseMoney(input.minOrder, "minOrder"),
  })
  return { ...current, restaurant }
}
export function setRestaurantOpen(current: MenuDocument, isOpen: boolean): MenuDocument {
  return { ...current, restaurant: parseRestaurant({ ...current.restaurant, isOpen }) }
}
