import { Failure } from "@cardapio/domain/failure"
import type { Role } from "@cardapio/contracts"

export type Actor = Readonly<{ userId: string; sessionId: string }>
export type TenantScope = Readonly<{ tenantId: string; restaurantId: string }>
export type Permission =
  "catalog:read" | "catalog:write" | "orders:read" | "orders:write" | "members:write"
const permissions: Record<Role, readonly Permission[]> = {
  OWNER: [
    "catalog:read",
    "catalog:write",
    "orders:read",
    "orders:write",
    "members:write",
  ],
  MANAGER: ["catalog:read", "catalog:write", "orders:read", "orders:write"],
  STAFF: ["catalog:read", "orders:read", "orders:write"],
}
export function assertPermission(role: Role, permission: Permission) {
  if (!permissions[role]?.includes(permission))
    throw new Failure("ACCESS_DENIED", "Você não tem permissão para esta operação.")
}
