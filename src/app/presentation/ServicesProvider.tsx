import type { IdGenerator } from "../../shared/application/ports"
import type { PrivacyService } from "../../modules/privacy/application/ports"
import type { FileDownloads } from "../../shared/application/file-downloads"
import type { PrintingService } from "../../modules/printing/application/printing"
import type { ReceiptOutputRenderer } from "../../modules/printing/application/receipt-output"
import type { TeamService } from "../../modules/identity/application/team"
import type { SecurityService } from "../../modules/identity/application/security"
import type { EngagementService } from "../../modules/engagement/application/ports"
import type { DevicePush } from "../../shared/application/push"
import type { DeviceLocation } from "../../shared/application/location"
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
import LegalProvider from "../../shared/presentation/legal/LegalProvider"
import { browserPrivacyNotice } from "../privacy"
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
  privacy?: PrivacyService
  files?: FileDownloads
  ids: IdGenerator
  engagement?: EngagementService
  devicePush?: DevicePush
  deviceLocation?: DeviceLocation
  drafts?: DraftManager
  mode?: "demo" | "api"
  auth?: IdentityService
  team?: TeamService
  security?: SecurityService
  payments?: PaymentsService
  documents?: DocumentExporter
  printing?: PrintingService
  receiptOutput?: ReceiptOutputRenderer
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
  const [notice] = useState(browserPrivacyNotice)
  return (
    <ServicesContext.Provider value={services}>
      <DraftsProvider manager={drafts}>
        <LegalProvider notice={notice} drafts={drafts}>
          {children}
        </LegalProvider>
      </DraftsProvider>
    </ServicesContext.Provider>
  )
}

export function useServices() {
  const services = useContext(ServicesContext)

  if (!services) throw new Error("ServicesProvider is required")

  return services
}
