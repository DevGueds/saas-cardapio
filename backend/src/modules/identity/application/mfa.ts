import { Failure } from "@cardapio/domain/failure"
import {
  mfaDisableSchema,
  mfaProofSchema,
  reauthenticationSchema,
  securityMemberChangeSchema,
  securityPolicyChangeSchema,
  uuid,
} from "@cardapio/contracts"
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  RequestLimiter,
  SecretTokens,
} from "../../../shared/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { Actor } from "../domain/identity.js"
import type { AccessPolicy, IdentityRepository, SessionRecord } from "./ports.js"
import type { MfaCryptography, MfaRepository } from "./mfa-ports.js"
import { mfaRequired, mfaPending } from "./mfa-state.js"

export class Mfa {
  constructor(
    private readonly repository: MfaRepository,
    private readonly identities: IdentityRepository,
    private readonly access: AccessPolicy,
    private readonly passwords: PasswordHasher,
    private readonly otp: MfaCryptography,
    private readonly tokens: SecretTokens,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
    private readonly ttl: number,
  ) {}
  private async session(actor: Actor) {
    const session = await this.identities.sessionByActor(actor, this.clock.now())
    if (
      !session ||
      (mfaPending(session) &&
        (!session.createdAt ||
          this.clock.now().getTime() - session.createdAt.getTime() > 600_000))
    )
      throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    return session
  }
  private async reauthenticate(actor: Actor, password: string) {
    await this.limiter.consume(`mfa-password:${actor.userId}`, 10, 900)
    const session = await this.session(actor)
    if (!(await this.passwords.verify(session.user.passwordHash, password)))
      throw new Failure("VALIDATION", "A senha atual não confere.", {
        currentPassword: "Confira sua senha atual.",
      })
    return session
  }
  status(actor: Actor) {
    return this.operation.run("identity.mfa-status", async () => {
      const session = await this.session(actor),
        credential = await this.repository.credential(actor.userId)
      return {
        enabled: !!credential?.enabledAt,
        required: mfaRequired(session.user),
        recoveryRemaining: credential?.enabledAt ? credential.recoveryHashes.length : 0,
      }
    })
  }
  setup(actor: Actor, input: unknown) {
    return this.operation.run("identity.mfa-setup", async () => {
      const data = validate(reauthenticationSchema, input),
        session = await this.reauthenticate(actor, data.currentPassword)
      const setup = await this.otp.setup(actor.userId, session.user.email),
        now = this.clock.now(),
        expires = new Date(now.getTime() + 600_000)
      await this.repository.setup(
        actor,
        session.user.passwordHash,
        setup.encrypted,
        expires,
        now,
      )
      return { secret: setup.secret, qr: setup.qr, expiresAt: expires.toISOString() }
    })
  }
  private async proof(actor: Actor, code: string, now: Date) {
    await this.limiter.consume(`mfa-proof:${actor.userId}`, 5, 300)
    const credential = await this.repository.credential(actor.userId)
    if (!credential)
      throw new Failure("VALIDATION", "Configure primeiro o aplicativo autenticador.")
    const counter = await this.otp.counter(actor.userId, credential.secret, code, now)
    return {
      credential,
      proof:
        counter !== null
          ? { counter }
          : {
              recoveryHash: this.tokens.hash(
                `mfa-recovery:${actor.userId}:${code.toLowerCase()}`,
              ),
            },
    }
  }
  verify(actor: Actor, input: unknown) {
    return this.operation.run("identity.mfa-verify", async () => {
      const { code } = validate(mfaProofSchema, input),
        previous = await this.session(actor),
        now = this.clock.now()
      const { credential, proof } = await this.proof(actor, code, now)
      const recoveryCodes = credential.enabledAt ? [] : this.otp.recoveryCodes()
      const token = this.tokens.create(),
        csrfToken = this.tokens.csrf(token),
        expiresAt = new Date(now.getTime() + this.ttl * 1000)
      await this.repository.complete(
        actor,
        credential.secret,
        proof,
        recoveryCodes.map((code) =>
          this.tokens.hash(`mfa-recovery:${actor.userId}:${code}`),
        ),
        {
          id: this.ids.next(),
          userId: actor.userId,
          tokenHash: this.tokens.hash(token),
          csrfHash: this.tokens.hash(csrfToken),
          expiresAt,
        },
        now,
      )
      return {
        token,
        session: {
          user: { id: previous.user.id, name: previous.user.name },
          csrfToken,
          expiresAt: expiresAt.toISOString(),
          mfa: "VERIFIED" as const,
        },
        recoveryCodes,
      }
    })
  }
  disable(actor: Actor, input: unknown) {
    return this.operation.run("identity.mfa-disable", async () => {
      await this.access.session(actor)
      const data = validate(mfaDisableSchema, input),
        session = await this.reauthenticate(actor, data.currentPassword),
        now = this.clock.now()
      const { credential, proof } = await this.proof(actor, data.code, now)
      await this.repository.disable(
        actor,
        credential.secret,
        proof,
        session.user.passwordHash,
        now,
      )
      return null
    })
  }
  policy(actor: Actor, tenantId: string) {
    return this.operation.run("identity.mfa-policy", async () => {
      await this.access.tenant(actor, tenantId, "security:write")
      return this.repository.policy(tenantId)
    })
  }
  private async management(
    actor: Actor,
    tenantId: string,
    password: string,
  ): Promise<SessionRecord> {
    await this.access.tenant(actor, tenantId, "security:write")
    return this.reauthenticate(actor, password)
  }
  changePolicy(actor: Actor, tenantId: string, input: unknown) {
    return this.operation.run("identity.mfa-policy-update", async () => {
      const data = validate(securityPolicyChangeSchema, input),
        session = await this.management(actor, tenantId, data.currentPassword)
      await this.repository.updatePolicy(
        actor,
        tenantId,
        session.user.passwordHash,
        { required: data.required },
        this.clock.now(),
      )
      return null
    })
  }
  changeMember(actor: Actor, tenantId: string, userId: string, input: unknown) {
    return this.operation.run("identity.mfa-member-update", async () => {
      const data = validate(securityMemberChangeSchema, input),
        session = await this.management(actor, tenantId, data.currentPassword)
      await this.repository.updatePolicy(
        actor,
        tenantId,
        session.user.passwordHash,
        { userId: validate(uuid, userId), override: data.override },
        this.clock.now(),
      )
      return null
    })
  }
}
