import { lockUser } from "../../../shared/infrastructure/row-locks.js"
import { Failure } from "@cardapio/domain/failure"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { Database, Transaction } from "../../../shared/infrastructure/database.js"
import type { Actor } from "../domain/identity.js"
import type { MfaRepository, MfaCredential } from "../application/mfa-ports.js"
import { mfaRequired } from "../application/mfa-state.js"
import { identityRelations } from "./prisma-identity.js"

const invalid = () =>
  new Failure(
    "VALIDATION",
    "Código inválido, expirado ou já usado. Aguarde o próximo código do aplicativo ou use outro código de recuperação.",
  )
const hashes = z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(10)
export class PrismaMfa implements MfaRepository {
  constructor(private readonly db: Database) {}
  credential(userId: string) {
    return this.db.run(async (client) => {
      const credential = await client.mfaCredential.findUnique({ where: { userId } })
      return credential
        ? { ...credential, recoveryHashes: hashes.parse(credential.recoveryHashes) }
        : null
    })
  }
  private async lock(tx: Transaction, actor: Actor, now: Date, passwordHash?: string) {
    await lockUser(tx, actor.userId)
    const session = await tx.session.findFirst({
      where: {
        id: actor.sessionId,
        userId: actor.userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { active: true, ...(passwordHash ? { passwordHash } : {}) },
      },
      include: { user: { include: identityRelations } },
    })
    if (!session)
      throw new Failure("UNAUTHENTICATED", "Sua sessão mudou. Entre novamente.")
    return session
  }
  setup: MfaRepository["setup"] = (actor, passwordHash, secret, expires, now) =>
    this.db.transaction(async (tx) => {
      await this.lock(tx, actor, now, passwordHash)
      const previous = await tx.mfaCredential.findUnique({
        where: { userId: actor.userId },
      })
      if (previous?.enabledAt)
        throw new Failure("CONFLICT", "A verificação em duas etapas já está ativa.")
      const data = {
        secret,
        pendingSessionId: actor.sessionId,
        pendingExpiresAt: expires,
        recoveryHashes: [],
        lastCounter: -1n,
      }
      await tx.mfaCredential.upsert({
        where: { userId: actor.userId },
        create: { userId: actor.userId, ...data },
        update: data,
      })
    })
  private async proof(
    tx: Transaction,
    actor: Actor,
    secret: string,
    proof: { counter?: number; recoveryHash?: string },
    now: Date,
  ) {
    const row = await tx.mfaCredential.findUnique({ where: { userId: actor.userId } })
    if (!row || row.secret !== secret) throw invalid()
    const credential: MfaCredential = {
      ...row,
      recoveryHashes: hashes.parse(row.recoveryHashes),
    }
    if (
      !credential.enabledAt &&
      (credential.pendingSessionId !== actor.sessionId ||
        !credential.pendingExpiresAt ||
        credential.pendingExpiresAt <= now)
    )
      throw invalid()
    if (proof.counter !== undefined && BigInt(proof.counter) > credential.lastCounter)
      return {
        credential,
        lastCounter: BigInt(proof.counter),
        recoveryHashes: credential.recoveryHashes,
      }
    if (
      credential.enabledAt &&
      proof.recoveryHash &&
      credential.recoveryHashes.includes(proof.recoveryHash)
    )
      return {
        credential,
        lastCounter: credential.lastCounter,
        recoveryHashes: credential.recoveryHashes.filter(
          (hash) => hash !== proof.recoveryHash,
        ),
      }
    throw invalid()
  }
  complete: MfaRepository["complete"] = (
    actor,
    secret,
    proof,
    recoveryHashes,
    session,
    now,
  ) =>
    this.db.transaction(async (tx) => {
      const previous = await this.lock(tx, actor, now)
      const accepted = await this.proof(tx, actor, secret, proof, now)
      if (
        accepted.credential.enabledAt &&
        !previous.mfaVerifiedAt &&
        now.getTime() - previous.createdAt.getTime() > 600_000
      )
        throw new Failure("UNAUTHENTICATED", "Entre novamente para confirmar seu acesso.")
      await tx.mfaCredential.update({
        where: { userId: actor.userId },
        data: {
          enabledAt: accepted.credential.enabledAt ?? now,
          lastCounter: accepted.lastCounter,
          recoveryHashes: accepted.credential.enabledAt
            ? accepted.recoveryHashes
            : recoveryHashes,
          pendingSessionId: null,
          pendingExpiresAt: null,
        },
      })
      // Activation invalidates other sessions; every challenge consumes/rotates its own session.
      await tx.session.updateMany({
        where: {
          userId: actor.userId,
          ...(accepted.credential.enabledAt ? { id: actor.sessionId } : {}),
          revokedAt: null,
        },
        data: { revokedAt: now },
      })
      await tx.session.create({ data: { ...session, mfaVerifiedAt: now } })
      if (!accepted.credential.enabledAt || proof.recoveryHash)
        await tx.securityEvent.create({
          data: {
            id: randomUUID(),
            actorUserId: actor.userId,
            action: accepted.credential.enabledAt ? "MFA_RECOVERY_USED" : "MFA_ENABLED",
          },
        })
    })
  disable: MfaRepository["disable"] = (actor, secret, proof, passwordHash, now) =>
    this.db.transaction(async (tx) => {
      const session = await this.lock(tx, actor, now, passwordHash)
      if (mfaRequired(session.user))
        throw new Failure(
          "ACCESS_DENIED",
          "Uma das suas lojas exige a verificação em duas etapas. Peça à gestão para revisar a exigência antes de desativar.",
        )
      if (!session.mfaVerifiedAt)
        throw new Failure(
          "ACCESS_DENIED",
          "Confirme seu acesso antes de desativar a proteção.",
        )
      await this.proof(tx, actor, secret, proof, now)
      await tx.mfaCredential.delete({ where: { userId: actor.userId } })
      await tx.securityEvent.create({
        data: { id: randomUUID(), actorUserId: actor.userId, action: "MFA_DISABLED" },
      })
      await tx.session.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: now },
      })
    })
  policy: MfaRepository["policy"] = (tenantId) =>
    this.db.run(async (client) => {
      const tenant = await client.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: {
          memberships: {
            where: { active: true, user: { active: true } },
            include: { user: { include: { mfa: { select: { enabledAt: true } } } } },
            orderBy: { userId: "asc" },
          },
        },
      })
      return {
        required: tenant.mfaRequired,
        members: tenant.memberships.map((member) => ({
          userId: member.userId,
          name: member.user.name,
          role: member.role,
          override: member.mfaOverride,
          enabled: !!member.user.mfa?.enabledAt,
        })),
      }
    })
  updatePolicy: MfaRepository["updatePolicy"] = (
    actor,
    tenantId,
    passwordHash,
    change,
    now,
  ) =>
    this.db.transaction(async (tx) => {
      const session = await this.lock(tx, actor, now, passwordHash)
      const membership = await tx.membership.findFirst({
        where: { tenantId, userId: actor.userId, active: true, tenant: { active: true } },
      })
      if (!membership || !["OWNER", "MANAGER"].includes(membership.role))
        throw new Failure(
          "ACCESS_DENIED",
          "Apenas a gestão pode alterar a segurança da loja.",
        )
      if (session.user.mfa?.enabledAt && !session.mfaVerifiedAt)
        throw new Failure("ACCESS_DENIED", "Confirme a verificação em duas etapas.")
      if (
        ("required" in change ? change.required : change.override === "REQUIRED") &&
        !session.mfaVerifiedAt
      )
        throw new Failure(
          "VALIDATION",
          "Ative primeiro a verificação em duas etapas na sua conta, para manter um acesso de gestão disponível.",
        )
      if ("required" in change)
        await tx.tenant.update({
          where: { id: tenantId },
          data: { mfaRequired: change.required },
        })
      else {
        const target = await tx.membership.findFirst({
          where: { tenantId, userId: change.userId, active: true },
        })
        if (!target) throw new Failure("NOT_FOUND", "Pessoa não encontrada nesta equipe.")
        if (membership.role === "MANAGER" && target.role === "OWNER")
          throw new Failure(
            "ACCESS_DENIED",
            "Somente o proprietário pode alterar sua própria exigência.",
          )
        await tx.membership.update({
          where: { tenantId_userId: { tenantId, userId: change.userId } },
          data: { mfaOverride: change.override },
        })
      }
      await tx.securityEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: actor.userId,
          tenantId,
          subjectUserId: "userId" in change ? change.userId : null,
          action:
            "required" in change
              ? change.required
                ? "POLICY_REQUIRED"
                : "POLICY_OPTIONAL"
              : `MEMBER_${change.override}`,
        },
      })
    })
}
