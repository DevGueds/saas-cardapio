import { Failure } from "@cardapio/domain/failure"
import { uuid } from "@cardapio/contracts"
import type { Clock } from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import { assertPermission, type Actor, type Permission } from "../domain/identity.js"
import type { AccessPolicy, AccessRepository, IdentityRepository } from "./ports.js"
import { mfaPending } from "./mfa-state.js"

export class Authorization implements AccessPolicy {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly access: AccessRepository,
    private readonly clock: Clock,
  ) {}
  async session(actor: Actor) {
    const session =
      actor && (await this.identities.sessionByActor(actor, this.clock.now()))
    if (!session)
      throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    if (mfaPending(session))
      throw new Failure(
        "MFA_REQUIRED",
        "Confirme a verificação em duas etapas para continuar.",
      )
  }
  async restaurant(actor: Actor, restaurantId: string, permission: Permission) {
    return (await this.grant(actor, restaurantId, permission)).scope
  }
  async grant(actor: Actor, restaurantId: string, permission: Permission) {
    validate(uuid, restaurantId)
    await this.session(actor)
    const membership = await this.access.restaurantMembership(actor, restaurantId)
    if (!membership)
      throw new Failure("NOT_FOUND", "Restaurante não encontrado ou acesso indisponível.")
    assertPermission(membership.role, permission)
    return membership
  }
  async tenant(actor: Actor, tenantId: string, permission: Permission) {
    validate(uuid, tenantId)
    await this.session(actor)
    const role = await this.access.membership(actor, tenantId)
    if (!role)
      throw new Failure("NOT_FOUND", "Organização não encontrada ou acesso indisponível.")
    assertPermission(role, permission)
  }
}
