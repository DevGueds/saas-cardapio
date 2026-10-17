import { Failure } from "@cardapio/domain/failure"
import type { Role } from "@cardapio/contracts"

export type Actor = Readonly<{ userId: string; sessionId: string }>
export type TenantScope = Readonly<{ tenantId: string; restaurantId: string }>
export type { Permission } from "@cardapio/domain/permissions"
import { can, type Permission } from "@cardapio/domain/permissions"
export function assertPermission(role: Role, permission: Permission) {
  if (!can(role, permission))
    throw new Failure("ACCESS_DENIED", "Você não tem permissão para esta operação.")
}
