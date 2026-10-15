import { orderPageSchema, orderSchema } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { OrdersService } from "../application/ports"
export class HttpOrders implements OrdersService {
  constructor(private readonly client: ApiClient) {}
  list(id: string, cursor?: string) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/orders${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      orderPageSchema,
    )
  }
  transition(
    ...[id, order, expectedRevision, status]: Parameters<OrdersService["transition"]>
  ) {
    return this.client.request(
      `/restaurants/${encodeURIComponent(id)}/orders/${encodeURIComponent(order)}/status`,
      orderSchema,
      { method: "PUT", body: { expectedRevision, status } },
    )
  }
}
