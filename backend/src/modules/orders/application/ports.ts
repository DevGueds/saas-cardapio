import type { MenuDocument } from "@cardapio/domain/menu-document"
import type {
  OrderView,
  OrderStatus,
  PreparedOrderView,
  Role,
  TrackingView,
} from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"
export interface OrderDraft {
  order: OrderView
  checkoutRevision: number
  whatsappUrl: string
  trackingHash: string
  trackingExpiresAt: Date
}
export interface OrderOperator {
  userId: string
  role: Role
}
export interface OrdersRepository {
  receipt(scope: TenantScope, idempotencyHash: string): Promise<PreparedOrderView | null>
  create(
    scope: TenantScope,
    identity: { idempotencyHash: string; payloadHash: string },
    prepare: (menu: MenuDocument) => OrderDraft,
  ): Promise<PreparedOrderView>
  list(
    scope: TenantScope,
    cursor?: string,
    operator?: OrderOperator,
  ): Promise<{ items: OrderView[]; nextCursor: string | null }>
  transition(
    scope: TenantScope,
    id: string,
    expectedRevision: number,
    status: OrderStatus,
    operator: OrderOperator,
    now: Date,
  ): Promise<OrderView>
  assign(
    scope: TenantScope,
    id: string,
    expectedRevision: number,
    courierId: string | null,
  ): Promise<OrderView>
  couriers(scope: TenantScope): Promise<{ userId: string; name: string }[]>
  track(
    scope: TenantScope,
    id: string,
    trackingHash: string,
    now: Date,
  ): Promise<TrackingView>
}
