import type { Transaction } from "./database.js"

export type RestaurantScope = { tenantId: string; restaurantId: string }

export function lockRestaurant(tx: Transaction, scope: RestaurantScope) {
  return tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${scope.restaurantId}::uuid AND "tenantId" = ${scope.tenantId}::uuid FOR UPDATE`
}
export function lockOrder(tx: Transaction, scope: RestaurantScope, id: string) {
  return tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id}::uuid AND "tenantId" = ${scope.tenantId}::uuid AND "restaurantId" = ${scope.restaurantId}::uuid FOR UPDATE`
}
export function lockUser(tx: Transaction, id: string) {
  return tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`
}
