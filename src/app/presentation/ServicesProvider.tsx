import type { TeamService } from "../../modules/identity/application/team"
import type { EngagementService } from "../../modules/engagement/application/ports"
import type { DevicePush } from "../../shared/application/push"
import type { PaymentsService } from "../../modules/payments/application/ports"
import type { DocumentExporter } from "../../shared/application/documents"
import type {
  CommerceService,
  MapsService,
} from "../../modules/commerce/application/ports"
import type { Quote, CheckoutOptions } from "@cardapio/domain/quote"
import type { Cart } from "@cardapio/domain/cart"
import type { TrackingView, PreparedOrderView } from "@cardapio/contracts"
import { browserDrafts } from "../drafts"
import DraftsProvider from "../../shared/presentation/DraftsProvider"
import type { DraftManager } from "../../shared/application/drafts"
import { useState } from "react"
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
  engagement?: EngagementService
  devicePush?: DevicePush
  drafts?: DraftManager
  mode?: "demo" | "api"
  auth?: IdentityService
  team?: TeamService
  payments?: PaymentsService
  documents?: DocumentExporter
  orders?: OrdersService
  commerce?: CommerceService
  maps?: MapsService
  quote?(
    slug: string,
    revision: number,
    cart: Cart,
    options: CheckoutOptions,
  ): Promise<Result<Quote>>
  tracking?(slug: string, id: string, token: string): Promise<Result<TrackingView>>
  menu: Pick<LoadMenu, "execute" | "subscribe"> & { loadAdmin?: LoadMenu["execute"] }
  catalog: Pick<CatalogCommands, "save" | "setAvailability" | "delete">
  restaurant: Pick<RestaurantCommands, "update" | "setOpen">
  checkout: Pick<PrepareOrder, "execute"> & {
    reset?(restaurantId: string): void
    hasPending?(restaurantId: string): boolean
    recover?(restaurantId: string): Promise<Result<PreparedOrderView | null>>
  }

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
  const [drafts] = useState(() => services.drafts ?? browserDrafts())
  return (
    <ServicesContext.Provider value={services}>
      <DraftsProvider manager={drafts}>{children}</DraftsProvider>
    </ServicesContext.Provider>
  )
}

export function useServices() {
  const services = useContext(ServicesContext)

  if (!services) throw new Error("ServicesProvider is required")

  return services
}
