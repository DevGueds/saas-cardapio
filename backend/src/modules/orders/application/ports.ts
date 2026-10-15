import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { OrderView, OrderStatus, PreparedOrderView } from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"
export interface OrderDraft {
  order: OrderView
  checkoutRevision: number
  whatsappUrl: string
}
export interface OrdersRepository {
  create(
    scope: TenantScope,
    identity: { idempotencyHash: string; payloadHash: string },
    prepare: (menu: MenuDocument) => OrderDraft,
  ): Promise<PreparedOrderView>
  list(
    scope: TenantScope,
    cursor?: string,
  ): Promise<{ items: OrderView[]; nextCursor: string | null }>
  transition(
    scope: TenantScope,
    id: string,
    expectedRevision: number,
    status: OrderStatus,
  ): Promise<OrderView>
}
