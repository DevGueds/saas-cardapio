import { Failure } from "@cardapio/domain/failure"
import {
  loginSchema,
  registrationSchema,
  accountRegistrationSchema,
  passwordChangeSchema,
  type SessionView,
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
import type { IdentityRepository, SessionInput, SessionRecord } from "./ports.js"

export interface AuthenticatedSession {
  actor: Actor
  csrfHash: string
  view: SessionView
}
export class Authentication {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordHasher,
    private readonly secrets: SecretTokens,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
    private readonly policy: { signupEnabled: boolean; ttl: number },
  ) {}
  private newSession(userId: string) {
    const token = this.secrets.create()
    const csrfToken = this.secrets.csrf(token)
    const expiresAt = new Date(this.clock.now().getTime() + this.policy.ttl * 1000)
    const record: SessionInput = {
      id: this.ids.next(),
      userId,
      tokenHash: this.secrets.hash(token),
      csrfHash: this.secrets.hash(csrfToken),
      expiresAt,
    }
    return { token, csrfToken, record }
  }
  register(input: unknown, ip: string, accountOnly = false) {
    return this.operation.run("identity.register", async () => {
      if (!this.policy.signupEnabled)
        throw new Failure(
          "ACCESS_DENIED",
          "Novos cadastros estão desabilitados neste ambiente.",
        )
      await this.limiter.consume("register:" + ip, 5, 900)
      const data = accountOnly
        ? { ...validate(accountRegistrationSchema, input), restaurantName: "", slug: "" }
        : validate(registrationSchema, input)
      const user = {
        id: this.ids.next(),
        name: data.name,
        email: data.email,
        passwordHash: await this.passwords.hash(data.password),
        active: true,
      }
      const session = this.newSession(user.id)
      try {
        await this.repository.createAccount(
          user,
          accountOnly
            ? null
            : {
                tenantId: this.ids.next(),
                restaurantId: this.ids.next(),
                name: data.restaurantName,
                slug: data.slug,
              },
          session.record,
        )
      } catch (error) {
        if (error instanceof Failure && error.code === "CONFLICT")
          throw new Failure(
            "ACCOUNT_UNAVAILABLE",
            "Não foi possível usar esse e-mail ou endereço de cardápio. Entre na conta existente ou escolha outro endereço.",
          )
        throw error
      }
      return {
        token: session.token,
        session: {
          user: { id: user.id, name: user.name },
          csrfToken: session.csrfToken,
          expiresAt: session.record.expiresAt.toISOString(),
        },
      }
    })
  }
  login(input: unknown, ip: string) {
    return this.operation.run("identity.login", async () => {
      await this.limiter.consume("login-ip:" + ip, 20, 900)
      const data = validate(loginSchema, input)
      await this.limiter.consume("login-account:" + data.email, 10, 900)
      const user = await this.repository.findAccount(data.email)
      const valid = await this.passwords.verify(
        user?.passwordHash ?? this.passwords.dummyHash,
        data.password,
      )
      if (!user || !valid || !user.active)
        throw new Failure("UNAUTHENTICATED", "E-mail ou senha inválidos.")
      const session = this.newSession(user.id)
      await this.repository.createSession(session.record)
      return {
        token: session.token,
        session: {
          user: { id: user.id, name: user.name },
          csrfToken: session.csrfToken,
          expiresAt: session.record.expiresAt.toISOString(),
        },
      }
    })
  }
  async authenticate(token: unknown): Promise<AuthenticatedSession> {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new Failure("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    const record = await this.repository.sessionByToken(
      this.secrets.hash(token),
      this.clock.now(),
    )
    if (!record)
      throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    return {
      actor: { userId: record.userId, sessionId: record.id },
      csrfHash: record.csrfHash,
      view: this.view(record, this.secrets.csrf(token)),
    }
  }
  private view(record: SessionRecord, csrfToken: string): SessionView {
    return {
      user: { id: record.user.id, name: record.user.name },
      csrfToken,
      expiresAt: record.expiresAt.toISOString(),
    }
  }
  logout(actor: Actor) {
    return this.operation.run("identity.logout", async () => {
      await this.repository.revoke(actor, this.clock.now())
      return null
    })
  }
  changePassword(actor: Actor, input: unknown) {
    return this.operation.run("identity.change-password", async () => {
      const data = validate(passwordChangeSchema, input)
      await this.limiter.consume("change-password:" + actor.userId, 5, 900)
      const session = await this.repository.sessionByActor(actor, this.clock.now())
      if (
        !session ||
        !(await this.passwords.verify(session.user.passwordHash, data.currentPassword))
      )
        throw new Failure(
          "UNAUTHENTICATED",
          "A senha atual não confere ou a sessão expirou.",
        )
      await this.repository.changePassword(
        actor,
        session.user.passwordHash,
        await this.passwords.hash(data.newPassword),
        this.clock.now(),
      )
      return null
    })
  }
}
