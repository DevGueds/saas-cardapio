import { Failure } from "@cardapio/domain/failure"
import type {
  EmailChallenge,
  EmailVerificationRepository,
} from "../application/email-ports.js"
import type { Database } from "../../../shared/infrastructure/database.js"
import { lockUser } from "../../../shared/infrastructure/row-locks.js"
import type { IdGenerator } from "../../../shared/application/ports.js"

export class PrismaEmailVerification implements EmailVerificationRepository {
  constructor(
    private readonly db: Database,
    private readonly ids: IdGenerator,
  ) {}
  pending(userId: string) {
    return this.db.run((tx) =>
      tx.emailVerificationChallenge.findUnique({
        where: { userId },
        select: { retryAt: true },
      }),
    )
  }
  reserve(challenge: EmailChallenge, now: Date) {
    return this.db.transaction(async (tx) => {
      await lockUser(tx, challenge.userId)
      const user = await tx.user.findUnique({
        where: { id: challenge.userId },
        select: { active: true, emailVerifiedAt: true },
      })
      if (!user?.active || user.emailVerifiedAt)
        throw new Failure(
          "CONFLICT",
          "Atualize a página para conferir a confirmação da sua conta.",
        )
      const existing = await tx.emailVerificationChallenge.findUnique({
        where: { userId: challenge.userId },
      })
      if (existing && existing.retryAt > now)
        throw new Failure(
          "RATE_LIMITED",
          "Aguarde 60 segundos entre os envios de código.",
        )
      await tx.emailVerificationChallenge.upsert({
        where: { userId: challenge.userId },
        create: challenge,
        update: { ...challenge, attempts: 0 },
      })
    })
  }
  cancel(userId: string, codeHash: string) {
    return this.db.run(async (tx) => {
      await tx.emailVerificationChallenge.deleteMany({ where: { userId, codeHash } })
    })
  }
  confirm(userId: string, codeHash: string, now: Date) {
    return this.db.transaction(async (tx) => {
      await lockUser(tx, userId)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { active: true, emailVerifiedAt: true },
      })
      if (!user?.active) return false
      if (user.emailVerifiedAt) return true
      const challenge = await tx.emailVerificationChallenge.findUnique({
        where: { userId },
      })
      if (!challenge || challenge.expiresAt <= now || challenge.attempts >= 5)
        return false
      // Return on mismatch so the failed attempt commits instead of rolling back.
      await tx.emailVerificationChallenge.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      })
      if (challenge.codeHash !== codeHash) return false
      await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } })
      await tx.securityEvent.create({
        data: {
          id: this.ids.next(),
          actorUserId: userId,
          action: "EMAIL_VERIFIED",
          createdAt: now,
        },
      })
      await tx.emailVerificationChallenge.delete({ where: { userId } })
      return true
    })
  }
}
