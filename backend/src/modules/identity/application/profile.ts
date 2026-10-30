import { updateProfileSchema, type ProfileView } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { Operation } from "../../../shared/application/operation.js"
import type {
  Clock,
  PasswordHasher,
  RequestLimiter,
} from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { Actor } from "../domain/identity.js"
import type { AccessPolicy, IdentityRepository } from "./ports.js"

export interface ProfileRepository {
  read(userId: string): Promise<ProfileView>
  update(
    actor: Actor,
    expected: { email: string; passwordHash: string },
    data: ProfileView,
    now: Date,
    deadline: Date,
  ): Promise<ProfileView>
}
export class Profile {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly identities: IdentityRepository,
    private readonly access: AccessPolicy,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
    private readonly graceSeconds: number,
    private readonly images?: { validate(image: string): Promise<void> },
  ) {}
  read(actor: Actor) {
    return this.operation.run("identity.profile", async () => {
      await this.access.session(actor)
      return this.repository.read(actor.userId)
    })
  }
  update(actor: Actor, input: unknown) {
    return this.operation.run("identity.update-profile", async () => {
      await this.access.session(actor)
      const { currentPassword, ...data } = validate(updateProfileSchema, input)
      await this.limiter.consume("profile:" + actor.userId, 10, 900)
      if (data.avatarUrl.startsWith("data:")) await this.images?.validate(data.avatarUrl)
      const record = await this.identities.sessionByActor(actor, this.clock.now())
      if (!record)
        throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
      if (
        data.email !== record.user.email &&
        !(await this.passwords.verify(record.user.passwordHash, currentPassword))
      )
        throw new Failure(
          "VALIDATION",
          "Confirme sua senha atual para alterar o e-mail.",
          { currentPassword: "A senha atual não confere." },
        )
      const now = this.clock.now()
      return this.repository.update(
        actor,
        { email: record.user.email, passwordHash: record.user.passwordHash },
        data,
        now,
        new Date(now.getTime() + this.graceSeconds * 1000),
      )
    })
  }
}
