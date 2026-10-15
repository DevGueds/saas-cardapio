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
  const auth = new HttpIdentity(client)
  const catalog = new HttpCatalog(client, new MenuRefresh())
  return {
    mode: "api",
    auth,
    orders: new HttpOrders(client),
    menu: catalog,
    catalog,
    restaurant: catalog,
    checkout: new HttpCheckout(client, (id) => catalog.slug(id), executor),
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
