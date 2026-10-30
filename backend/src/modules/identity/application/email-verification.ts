import { emailCodeSchema } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { Clock, RequestLimiter } from "../../../shared/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { Actor } from "../domain/identity.js"
import type { IdentityRepository } from "./ports.js"
import type {
  EmailVerificationRepository,
  VerificationMail,
  VerificationCodes,
} from "./email-ports.js"
import { emailState } from "./email-state.js"
import { mfaPending } from "./mfa-state.js"

export class EmailVerification {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly repository: EmailVerificationRepository,
    private readonly mail: VerificationMail,
    private readonly codes: VerificationCodes,
    private readonly clock: Clock,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
  ) {}
  private async account(actor: Actor) {
    const record = await this.identities.sessionByActor(actor, this.clock.now())
    if (!record)
      throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    if (mfaPending(record))
      throw new Failure(
        "MFA_REQUIRED",
        "Confirme a verificação em duas etapas para continuar.",
      )
    return record.user
  }
  status(actor: Actor) {
    return this.operation.run("identity.email-status", async () => {
      const state = emailState(await this.account(actor), this.clock.now())
      if (!state)
        throw new Failure("CONFIGURATION", "A confirmação de e-mail não está disponível.")
      const pending = await this.repository.pending(actor.userId)
      return { ...state, retryAt: pending?.retryAt.toISOString() ?? null }
    })
  }
  send(actor: Actor) {
    return this.operation.run("identity.email-send", async () => {
      const user = await this.account(actor)
      const now = this.clock.now(),
        retryAt = new Date(now.getTime() + 60_000)
      if (user.emailVerifiedAt) return { sent: false, retryAt: now.toISOString() }
      await this.limiter.consume("email-send:" + user.id, 5, 3600)
      const code = this.codes.create(),
        codeHash = this.codes.hash(user.id, code)
      await this.repository.reserve(
        {
          userId: user.id,
          codeHash,
          expiresAt: new Date(now.getTime() + 600_000),
          retryAt,
        },
        now,
      )
      try {
        await this.mail.send(user.email, code)
      } catch {
        await this.repository.cancel(user.id, codeHash)
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "Não conseguimos enviar o código agora. Sua conta está salva. Tente novamente em instantes.",
        )
      }
      return { sent: true, retryAt: retryAt.toISOString() }
    })
  }
  confirm(actor: Actor, input: unknown) {
    return this.operation.run("identity.email-confirm", async () => {
      const user = await this.account(actor)
      await this.limiter.consume("email-confirm:" + user.id, 10, 900)
      const { code } = validate(emailCodeSchema, input)
      if (user.emailVerifiedAt) return null
      if (
        !(await this.repository.confirm(
          user.id,
          this.codes.hash(user.id, code),
          this.clock.now(),
        ))
      )
        throw new Failure(
          "VALIDATION",
          "Código inválido, expirado ou com tentativas esgotadas. Confira os 6 números ou solicite outro código.",
          { code: "Confira o código recebido ou solicite um novo." },
        )
      return null
    })
  }
}
