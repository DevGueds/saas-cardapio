import { parseMoney } from "./money.js"
import { brazilianPhone, text } from "./validation.js"
import { parseRestaurant } from "./restaurant.js"
import type { MenuDocument } from "./menu-document.js"
import {
  effectiveStoreOpen,
  nextScheduledChange,
  parseStoreHours,
  type HoursInput,
} from "./store-hours.js"
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
export function setRestaurantOpen(
  current: MenuDocument,
  isOpen: boolean,
  now = Date.now(),
): MenuDocument {
  const hours = current.restaurant.hours
  const until = hours?.enabled
    ? Math.min(nextScheduledChange(hours, now) ?? Infinity, now + 12 * 3600000)
    : null
  return {
    ...current,
    restaurant: parseRestaurant({
      ...current.restaurant,
      isOpen,
      ...(hours?.enabled
        ? {
            hours: {
              ...hours,
              override: { isOpen, until: new Date(until!).toISOString() },
            },
          }
        : {}),
    }),
  }
}
export function updateStoreHours(
  current: MenuDocument,
  input: HoursInput,
  now = Date.now(),
): MenuDocument {
  const hours = parseStoreHours({ ...input, override: null })
  const restaurant = parseRestaurant({ ...current.restaurant, hours })
  return {
    ...current,
    restaurant: { ...restaurant, isOpen: effectiveStoreOpen(restaurant, now) },
  }
}
export function applyStoreHours(current: MenuDocument, now = Date.now()): MenuDocument {
  if (!current.restaurant.hours?.enabled) return current
  return {
    ...current,
    restaurant: {
      ...current.restaurant,
      isOpen: effectiveStoreOpen(current.restaurant, now),
    },
  }
}
