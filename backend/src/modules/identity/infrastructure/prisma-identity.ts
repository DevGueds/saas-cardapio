import { lockUser } from "../../../shared/infrastructure/row-locks.js"
import { Failure } from "@cardapio/domain/failure"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
import type { Actor } from "../domain/identity.js"
import type {
  Account,
  IdentityRepository,
  FirstStore,
  SessionInput,
} from "../application/ports.js"

export function restaurantDefaults(store: {
  id: string
  tenantId: string
  name: string
  slug: string
}) {
  return {
    ...store,
    description: "",
    whatsapp: "",
    address: "",
    logoUrl: "",
    coverUrl: "",
    eta: "30–45 min",
    isOpen: false,
  }
}
export async function createFirstStore(
  tx: Transaction,
  userId: string,
  tenant: { id: string; name: string },
  store: FirstStore,
) {
  await tx.tenant.create({ data: tenant })
  await tx.membership.create({ data: { tenantId: tenant.id, userId, role: "OWNER" } })
  await tx.restaurant.create({
    data: restaurantDefaults({
      id: store.restaurantId,
      tenantId: tenant.id,
      name: store.name,
      slug: store.slug,
    }),
  })
}
export class PrismaIdentity implements IdentityRepository {
  constructor(private readonly db: Database) {}
  findAccount(email: string) {
    return this.db.run((client) =>
      client.user.findUnique({ where: { email }, include: identityRelations }),
    )
  }
  createAccount(account: Account, store: FirstStore | null, session: SessionInput) {
    return this.db.transaction(async (tx) => {
      const { id, name, email, passwordHash, active } = account
      await tx.user.create({ data: { id, name, email, passwordHash, active } })
      if (store)
        await createFirstStore(
          tx,
          account.id,
          { id: store.tenantId, name: store.name },
          store,
        )
      await tx.session.create({ data: session })
    })
  }
  createSession(session: SessionInput, expectedPasswordHash: string) {
    return this.db.transaction(async (client) => {
      await lockUser(client, session.userId)
      const user = await client.user.findFirst({
        where: { id: session.userId, passwordHash: expectedPasswordHash, active: true },
        select: { id: true },
      })
      if (!user)
        throw new Failure("UNAUTHENTICATED", "As credenciais mudaram. Entre novamente.")
      await client.session.create({ data: session })
    })
  }
  sessionByToken(tokenHash: string, now: Date) {
    return this.db.run((client) =>
      client.session.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { active: true },
        },
        include: { user: { include: identityRelations } },
      }),
    )
  }
  sessionByActor(actor: Actor, now: Date) {
    return this.db.run((client) =>
      client.session.findFirst({
        where: {
          id: actor.sessionId,
          userId: actor.userId,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { active: true },
        },
        include: { user: { include: identityRelations } },
      }),
    )
  }
  revoke(actor: Actor, now: Date) {
    return this.db.run(async (client) => {
      await client.session.updateMany({
        where: { id: actor.sessionId, userId: actor.userId },
        data: { revokedAt: now },
      })
    })
  }
  changePassword(actor: Actor, previousHash: string, nextHash: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: actor.userId, passwordHash: previousHash, active: true },
        data: { passwordHash: nextHash },
      })
      if (updated.count !== 1)
        throw new Failure("CONFLICT", "As credenciais mudaram. Entre novamente.")
      await tx.session.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: now },
      })
    })
  }
}
export const identityRelations = {
  mfa: { select: { enabledAt: true } },
  memberships: {
    select: {
      active: true,
      mfaOverride: true,
      tenant: { select: { active: true, mfaRequired: true } },
    },
  },
} as const
