import { randomUUID } from "node:crypto"
import type { Transaction } from "./database.js"
// Called inside the originating transaction. No customer data is copied to the outbox.
export function orderEvent(
  tx: Transaction,
  scope: { tenantId: string; restaurantId: string },
  orderId: string,
  kind: "ORDER" | "PAYMENT" | "REVERSAL",
  status: string,
  now = new Date(),
) {
  return tx.notificationEvent.create({
    data: { ...scope, id: randomUUID(), orderId, kind, status, createdAt: now },
  })
}
