import { Failure } from "@cardapio/domain/failure"
import {
  legalAcceptanceSchema,
  privacyExportInputSchema,
  privacyRequestInputSchema,
} from "@cardapio/contracts"
import type { Actor } from "../../identity/domain/identity.js"
import type {
  AccessPolicy,
  IdentityRepository,
} from "../../identity/application/ports.js"
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  RequestLimiter,
} from "../../../shared/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { PrivacyRepository } from "./ports.js"

export class Privacy {
  constructor(
    private readonly repository: PrivacyRepository,
    private readonly access: AccessPolicy,
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
  ) {}

  profile(actor: Actor) {
    return this.operation.run("privacy.profile", async () => {
      await this.access.session(actor)
      return this.repository.profile(actor.userId)
    })
  }
  export(actor: Actor, input: unknown) {
    return this.operation.run("privacy.export", async () => {
      await this.access.session(actor)
      const data = validate(privacyExportInputSchema, input)
      await this.limiter.consume("privacy-export:" + actor.userId, 5, 3600)
      const session = await this.identities.sessionByActor(actor, this.clock.now())
      if (!session)
        throw new Failure("UNAUTHENTICATED", "Entre novamente para consultar seus dados.")
      if (!(await this.passwords.verify(session.user.passwordHash, data.currentPassword)))
        throw new Failure(
          "VALIDATION",
          "A senha atual não confere. Revise e tente novamente.",
          {
            currentPassword: "A senha atual não confere.",
          },
        )
      return this.repository.export(actor.userId, this.clock.now())
    })
  }
  accept(actor: Actor, input: unknown) {
    return this.operation.run("privacy.accept", async () => {
      await this.access.session(actor)
      const data = validate(legalAcceptanceSchema, input)
      await this.repository.accept(actor.userId, data, this.ids.next(), this.clock.now())
      return null
    })
  }
  request(actor: Actor, input: unknown) {
    return this.operation.run("privacy.request", async () => {
      await this.access.session(actor)
      const data = validate(privacyRequestInputSchema, input)
      await this.limiter.consume("privacy-request:" + actor.userId, 5, 86400)
      return this.repository.request(
        actor.userId,
        data,
        this.ids.next(),
        this.clock.now(),
      )
    })
  }
}
