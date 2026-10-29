import type { MenuRepository } from "../application/ports.js"
import type { CacheStore } from "../../../shared/application/cache.js"
import type { TenantScope } from "../../identity/domain/identity.js"
import { parseMenuDocument, type MenuDocument } from "@cardapio/domain/menu-document"
import { Failure } from "@cardapio/domain/failure"
import { applyStoreHours } from "@cardapio/domain/restaurant-changes"
export class CachedMenu implements MenuRepository {
  private readonly pending = new Map<string, Promise<MenuDocument>>()
  constructor(
    private readonly repository: MenuRepository,
    private readonly cache: CacheStore,
  ) {}
  resolve(slug: string) {
    return this.repository.resolve(slug)
  }
  load(scope: TenantScope) {
    return this.repository.load(scope)
  }
  async commit(scope: TenantScope, revision: number, menu: MenuDocument) {
    const saved = await this.repository.commit(scope, revision, menu)
    await this.cache.delete("menu:" + saved.restaurant.slug)
    return saved
  }
  publicMenu(slug: string): Promise<MenuDocument> {
    const previous = this.pending.get(slug)
    if (previous) return previous
    const pending = this.readPublic(slug).finally(() => this.pending.delete(slug))
    this.pending.set(slug, pending)
    return pending
  }
  private async readPublic(slug: string) {
    const key = "menu:" + slug,
      cached = await this.cache.get(key)
    if (cached !== null) {
      try {
        const value: unknown = JSON.parse(cached)
        const id = (value as MenuDocument).restaurant.id
        const menu = parseMenuDocument(value, id)
        if (menu.restaurant.slug !== slug) throw new Error()
        return applyStoreHours(menu)
      } catch {
        throw new Failure(
          "CORRUPT_DATA",
          "O cardápio temporário está inválido. Aguarde alguns segundos e atualize.",
          {},
          "invalid_menu_cache",
        )
      }
    }
    const menu = await this.repository.load(await this.repository.resolve(slug)),
      serialized = JSON.stringify(menu)
    // Large inline images remain supported but do not consume the shared cache budget.
    if (Buffer.byteLength(serialized) <= 1_000_000)
      await this.cache.set(key, serialized, 5)
    return menu
  }
}
