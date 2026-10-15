import type { OrderView, OrderStatus, Result } from "@cardapio/contracts"
export interface OrdersService {
  list(
    restaurantId: string,
    cursor?: string,
  ): Promise<Result<{ items: OrderView[]; nextCursor: string | null }>>
  transition(
    restaurantId: string,
    orderId: string,
    expectedRevision: number,
    status: OrderStatus,
  ): Promise<Result<OrderView>>
}
