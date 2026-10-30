import { profileSchema, type ProfileView } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { Database } from "../../../shared/infrastructure/database.js"
import { lockUser } from "../../../shared/infrastructure/row-locks.js"
import type { Actor } from "../domain/identity.js"
import type { ProfileRepository } from "../application/profile.js"
const select = { name: true, email: true, phone: true, avatarUrl: true } as const
export class PrismaProfile implements ProfileRepository {
  constructor(private readonly db: Database) {}
  read(userId: string) {
    return this.db.run(async (tx) => {
      const row = await tx.user.findFirst({ where: { id: userId, active: true }, select })
      if (!row) throw new Failure("UNAUTHENTICATED", "Conta indisponível.")
      return profileSchema.parse(row)
    })
  }
  update(
    actor: Actor,
    expected: { email: string; passwordHash: string },
    data: ProfileView,
    now: Date,
    deadline: Date,
  ) {
    return this.db.transaction(async (tx) => {
      await lockUser(tx, actor.userId)
      const session = await tx.session.findFirst({
        where: {
          id: actor.sessionId,
          userId: actor.userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      })
      if (!session)
        throw new Failure("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
      const emailChanged = expected.email !== data.email
      const updated = await tx.user.updateMany({
        where: {
          id: actor.userId,
          email: expected.email,
          passwordHash: expected.passwordHash,
          active: true,
        },
        data: {
          ...data,
          ...(emailChanged
            ? { emailVerifiedAt: null, emailVerificationDeadline: deadline }
            : {}),
        },
      })
      if (updated.count !== 1)
        throw new Failure(
          "CONFLICT",
          "Seu perfil mudou. Recarregue antes de salvar novamente.",
        )
      if (emailChanged) {
        await tx.emailVerificationChallenge.deleteMany({
          where: { userId: actor.userId },
        })
        await tx.session.updateMany({
          where: { userId: actor.userId, id: { not: actor.sessionId }, revokedAt: null },
          data: { revokedAt: now },
        })
      }
      return data
    })
  }
}
