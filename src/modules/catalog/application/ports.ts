import type { MenuDocument } from "./menu-document"

export interface MenuRepository {
  load(restaurantId: string): Promise<MenuDocument>

  commit(
    restaurantId: string,
    expectedRevision: number,
    next: MenuDocument,
  ): Promise<MenuDocument>

  subscribe(restaurantId: string, listener: () => void): () => void
}

export interface RestaurantDirectory {
  resolve(slug: string): Promise<string>
}
