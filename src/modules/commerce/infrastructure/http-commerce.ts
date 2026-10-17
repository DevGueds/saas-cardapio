import { z } from "zod"
import { menuSchema, postalAddressSchema } from "@cardapio/contracts"
import type { CommerceService, MapsService } from "../application/ports"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { MenuRefresh } from "../../catalog/infrastructure/menu-refresh"
export class HttpCommerce implements CommerceService, MapsService {
  constructor(
    private readonly client: ApiClient,
    private readonly refresh: MenuRefresh,
  ) {}
  private async mutate(
    id: string,
    suffix: string,
    body: unknown,
    method: "PUT" | "DELETE" = "PUT",
  ) {
    const result = await this.client.request(
      `/restaurants/${encodeURIComponent(id)}/${suffix}`,
      menuSchema,
      { method, body },
    )
    if (result.ok) this.refresh.changed(id)
    return result
  }
  combo(...[id, revision, combo]: Parameters<CommerceService["combo"]>) {
    return this.mutate(id, "combos", { expectedRevision: revision, combo })
  }
  promotion(...[id, revision, promotion]: Parameters<CommerceService["promotion"]>) {
    return this.mutate(id, "promotions", { expectedRevision: revision, promotion })
  }
  delivery(...[id, revision, delivery]: Parameters<CommerceService["delivery"]>) {
    return this.mutate(id, "delivery", { expectedRevision: revision, delivery })
  }
  remove(...[id, revision, kind, offerId]: Parameters<CommerceService["remove"]>) {
    return this.mutate(
      id,
      `${kind}/${encodeURIComponent(offerId)}`,
      { expectedRevision: revision },
      "DELETE",
    )
  }
  lookup(cep: string) {
    return this.client.request(
      `/public/addresses/${encodeURIComponent(cep)}`,
      postalAddressSchema,
    )
  }
  configuration() {
    return this.client.request(
      "/configuration",
      z.object({ mapTileUrl: z.string().optional() }),
    )
  }
}
