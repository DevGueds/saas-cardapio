import { menuSchema } from "@cardapio/contracts"
import type { MenuDocument } from "../application/menu-document"
import type { HoursInput } from "@cardapio/domain/store-hours"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { SaveProductInput } from "../application/catalog-commands"
import type { RestaurantSettingsInput } from "../../restaurant/application/restaurant-commands"
import type { MenuRefresh } from "./menu-refresh"
export class HttpCatalog {
  private readonly slugs = new Map<string, string>()
  constructor(
    private readonly client: ApiClient,
    private readonly refresh: MenuRefresh,
  ) {}
  slug(id: string) {
    return this.slugs.get(id)
  }
  subscribe(id: string, listener: (menu?: MenuDocument) => void) {
    return this.refresh.subscribe(id, listener)
  }
  async execute(slug: string) {
    const result = await this.client.request(
      `/public/restaurants/${encodeURIComponent(slug)}/menu`,
      menuSchema,
    )
    if (result.ok)
      this.slugs.set(result.value.restaurant.id, result.value.restaurant.slug)
    return result
  }
  async loadAdmin(id: string) {
    const result = await this.client.request(
      `/restaurants/${encodeURIComponent(id)}/menu`,
      menuSchema,
    )
    if (result.ok)
      this.slugs.set(result.value.restaurant.id, result.value.restaurant.slug)
    return result
  }
  private async mutate(
    id: string,
    suffix: string,
    method: "POST" | "PUT" | "DELETE",
    body: unknown,
  ) {
    const result = await this.client.request(
      `/restaurants/${encodeURIComponent(id)}/${suffix}`,
      menuSchema,
      { method, body },
    )
    if (result.ok) this.refresh.changed(id, result.value)
    return result
  }
  save(input: SaveProductInput) {
    const { restaurantId, id, ...data } = input
    return this.mutate(
      restaurantId,
      id ? `products/${encodeURIComponent(id)}` : "products",
      id ? "PUT" : "POST",
      data,
    )
  }
  setAvailability(
    id: string,
    expectedRevision: number,
    product: string,
    available: boolean,
  ) {
    return this.mutate(
      id,
      `products/${encodeURIComponent(product)}/availability`,
      "PUT",
      { expectedRevision, available },
    )
  }
  delete(id: string, expectedRevision: number, product: string) {
    return this.mutate(id, `products/${encodeURIComponent(product)}`, "DELETE", {
      expectedRevision,
    })
  }
  update(id: string, expectedRevision: number, input: RestaurantSettingsInput) {
    const {
      name,
      description,
      whatsapp,
      address,
      logoUrl,
      coverUrl,
      deliveryFee,
      minOrder,
      eta,
    } = input
    return this.mutate(id, "settings", "PUT", {
      name,
      description,
      whatsapp,
      address,
      logoUrl,
      coverUrl,
      deliveryFee,
      minOrder,
      eta,
      expectedRevision,
    })
  }
  setOpen(id: string, expectedRevision: number, isOpen: boolean) {
    return this.mutate(id, "open", "PUT", { expectedRevision, isOpen })
  }
  hours(id: string, expectedRevision: number, schedule: HoursInput) {
    return this.mutate(id, "hours", "PUT", { expectedRevision, schedule })
  }
}
