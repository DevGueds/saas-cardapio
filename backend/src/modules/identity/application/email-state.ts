import type { EmailVerificationView } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { Account } from "./ports.js"

export function emailState(user: Account, now: Date): EmailVerificationView | undefined {
  if (!user.emailVerificationDeadline) return undefined
  return {
    email: user.email,
    verified: !!user.emailVerifiedAt,
    required: !user.emailVerifiedAt && now >= user.emailVerificationDeadline,
    deadline: user.emailVerificationDeadline.toISOString(),
  }
}
export function assertEmailVerified(user: Account, now: Date) {
  if (emailState(user, now)?.required)
    throw new Failure(
      "EMAIL_VERIFICATION_REQUIRED",
      "Confirme seu e-mail para continuar usando sua conta. Envie um novo código na tela de confirmação.",
    )
}
