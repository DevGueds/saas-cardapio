import type { OrderView, OrderStatus, Result } from "@cardapio/contracts"
export interface OrdersService {
  couriers(restaurantId: string): Promise<Result<{ userId: string; name: string }[]>>
  assign(
    restaurantId: string,
    orderId: string,
    expectedRevision: number,
    courierId: string | null,
  ): Promise<Result<OrderView>>
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
