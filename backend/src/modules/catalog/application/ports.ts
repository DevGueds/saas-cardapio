import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { TenantScope } from "../../identity/domain/identity.js"
export interface MenuRepository {
  resolve(slug: string): Promise<TenantScope>
  load(scope: TenantScope): Promise<MenuDocument>
  commit(
    scope: TenantScope,
    expectedRevision: number,
    next: MenuDocument,
  ): Promise<MenuDocument>
}
