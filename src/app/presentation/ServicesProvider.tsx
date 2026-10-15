import type { IdentityService } from "../../modules/identity/application/ports"
import type { OrdersService } from "../../modules/orders/application/ports"
import { createContext, useContext, type ReactNode } from "react"

import type { CatalogCommands } from "../../modules/catalog/application/catalog-commands"

import type { LoadMenu } from "../../modules/catalog/application/load-menu"

import type { RestaurantCommands } from "../../modules/restaurant/application/restaurant-commands"

import type { PrepareOrder } from "../../modules/checkout/application/prepare-order"

import type { Result } from "../../shared/application/result"

import type { ImageReader } from "../../shared/application/image-reader"

export interface ApplicationServices {
  mode?: "demo" | "api"
  auth?: IdentityService
  orders?: OrdersService
  menu: Pick<LoadMenu, "execute" | "subscribe"> & { loadAdmin?: LoadMenu["execute"] }
  catalog: Pick<CatalogCommands, "save" | "setAvailability" | "delete">
  restaurant: Pick<RestaurantCommands, "update" | "setOpen">
  checkout: Pick<PrepareOrder, "execute"> & { reset?(restaurantId: string): void }

  images: ImageReader
  checkAdmin(): Promise<Result<void>>
  reportUnexpected(cause?: unknown): Promise<Result<never>>
}

const ServicesContext = createContext<ApplicationServices | null>(null)

export default function ServicesProvider({
  services,
  children,
}: {
  services: ApplicationServices
  children: ReactNode
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

export function useServices() {
  const services = useContext(ServicesContext)

  if (!services) throw new Error("ServicesProvider is required")

  return services
}
