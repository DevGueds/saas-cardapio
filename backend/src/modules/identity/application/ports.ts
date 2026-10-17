import type { Role, RestaurantAccess } from "@cardapio/contracts"
import type { Actor, Permission, TenantScope } from "../domain/identity.js"

export interface Account {
  id: string
  name: string
  email: string
  passwordHash: string
  active: boolean
}
export interface SessionRecord {
  id: string
  userId: string
  tokenHash: string
  csrfHash: string
  expiresAt: Date
  revokedAt: Date | null
  user: Account
}
export interface SessionInput {
  id: string
  userId: string
  tokenHash: string
  csrfHash: string
  expiresAt: Date
}
export interface FirstStore {
  tenantId: string
  restaurantId: string
  name: string
  slug: string
}
export interface IdentityRepository {
  findAccount(email: string): Promise<Account | null>
  createAccount(
    account: Account,
    store: FirstStore | null,
    session: SessionInput,
  ): Promise<void>
  createSession(session: SessionInput): Promise<void>
  sessionByToken(tokenHash: string, now: Date): Promise<SessionRecord | null>
  sessionByActor(actor: Actor, now: Date): Promise<SessionRecord | null>
  revoke(actor: Actor, now: Date): Promise<void>
  changePassword(
    actor: Actor,
    previousHash: string,
    nextHash: string,
    now: Date,
  ): Promise<void>
}
export interface AccessRepository {
  membership(actor: Actor, tenantId: string): Promise<Role | null>
  restaurantMembership(
    actor: Actor,
    restaurantId: string,
  ): Promise<{ scope: TenantScope; role: Role } | null>
  restaurants(actor: Actor): Promise<RestaurantAccess[]>
  createTenant(
    actor: Actor,
    tenant: { id: string; name: string },
    store: FirstStore,
  ): Promise<void>
  createRestaurant(
    tenantId: string,
    restaurant: { id: string; name: string; slug: string },
  ): Promise<void>
  addMember(tenantId: string, email: string, role: Exclude<Role, "OWNER">): Promise<void>
  removeMember(tenantId: string, userId: string): Promise<void>
  members(tenantId: string): Promise<{ userId: string; name: string; role: Role }[]>
}
export interface AccessPolicy {
  grant(
    actor: Actor,
    restaurantId: string,
    permission: Permission,
  ): Promise<{ scope: TenantScope; role: Role }>
  restaurant(
    actor: Actor,
    restaurantId: string,
    permission: Permission,
  ): Promise<TenantScope>
  tenant(actor: Actor, tenantId: string, permission: Permission): Promise<void>
  session(actor: Actor): Promise<void>
}
