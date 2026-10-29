import { sha256Fingerprint } from "../shared/infrastructure/sha256-fingerprint"
import { HttpAnalytics } from "../modules/analytics/infrastructure/http-analytics"
import { HttpPrivacy } from "../modules/privacy/infrastructure/http-privacy"
import { BrowserFileDownloads } from "../shared/infrastructure/browser-file-downloads"
import { HttpPrinting } from "../modules/printing/infrastructure/http-printing"
import { BrowserReceiptOutputRenderer } from "../modules/printing/infrastructure/browser-receipt-output"
import { HttpTeam } from "../modules/identity/infrastructure/http-team"
import { HttpEngagement } from "../modules/engagement/infrastructure/http-engagement"
import { BrowserPush } from "../shared/infrastructure/device-push"
import { BrowserLocation } from "../shared/infrastructure/device-location"
import { HttpPayments } from "../modules/payments/infrastructure/http-payments"
import { PdfDocuments } from "../shared/infrastructure/pdf-documents"
import { quoteSchema, trackingSchema } from "@cardapio/contracts"
import { HttpCommerce } from "../modules/commerce/infrastructure/http-commerce"
import { browserDrafts } from "./drafts"
import type { ApplicationServices } from "./presentation/ServicesProvider"
import { Executor } from "../shared/application/execute"
import { ApiClient } from "../shared/infrastructure/api-client"
import { browserIds, consoleDiagnostics } from "../shared/infrastructure/browser-services"
import { BrowserImageReader } from "../shared/infrastructure/browser-image-reader"
import { HttpIdentity } from "../modules/identity/infrastructure/http-identity"
import { HttpCatalog } from "../modules/catalog/infrastructure/http-catalog"
import { MenuRefresh } from "../modules/catalog/infrastructure/menu-refresh"
import { HttpCheckout } from "../modules/checkout/infrastructure/http-checkout"
import { HttpOrders } from "../modules/orders/infrastructure/http-orders"
export function apiServices(): ApplicationServices {
  const executor = new Executor(consoleDiagnostics, browserIds)
  const client = new ApiClient(import.meta.env.VITE_API_BASE_URL, executor)
  const drafts = browserDrafts()
  const auth = new HttpIdentity(client, drafts)
  client.subscribeExpired(() => drafts.clearPrefix("api:admin:"))
  const refresh = new MenuRefresh()
  const catalog = new HttpCatalog(client, refresh)
  const commerce = new HttpCommerce(client, refresh)
  return {
    mode: "api",
    analytics: new HttpAnalytics(client),
    privacy: new HttpPrivacy(client),
    files: new BrowserFileDownloads(executor),
    ids: browserIds,
    engagement: new HttpEngagement(client),
    devicePush: new BrowserPush(executor),
    deviceLocation: new BrowserLocation(executor),
    payments: new HttpPayments(client),
    documents: new PdfDocuments(executor),
    printing: new HttpPrinting(client),
    receiptOutput: new BrowserReceiptOutputRenderer(executor),
    drafts,
    auth,
    team: new HttpTeam(client),
    security: new HttpSecurity(client),
    commerce,
    maps: commerce,
    quote: (slug, revision, cart, options) =>
      client.request(
        `/public/restaurants/${encodeURIComponent(slug)}/checkout/quote`,
        quoteSchema,
        { method: "POST", body: { expectedRevision: revision, cart, options } },
      ),
    tracking: (slug, id, token) =>
      client.request(
        `/public/restaurants/${encodeURIComponent(slug)}/orders/${encodeURIComponent(id)}`,
        trackingSchema,
        { trackingToken: token },
      ),
    orders: new HttpOrders(client),
    menu: catalog,
    catalog,
    restaurant: catalog,
    checkout: new HttpCheckout(
      client,
      (id) => catalog.slug(id),
      executor,
      drafts,
      browserIds,
      sha256Fingerprint,
    ),
    images: new BrowserImageReader(executor),
    checkAdmin: async () => {
      const result = await auth.session()
      return result.ok ? { ok: true, value: undefined } : result
    },
    reportUnexpected: (cause) =>
      executor.run("presentation", "render", async () => {
        throw cause ?? new Error("render_failure")
      }),
  }
}
import { HttpSecurity } from "../modules/identity/infrastructure/http-security"
