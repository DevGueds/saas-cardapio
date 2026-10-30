import { Failure } from "@cardapio/domain/failure"
import {
  privacyExportSchema,
  privacyProfileSchema,
  privacyRequestSchema,
  type LegalAcceptance,
} from "@cardapio/contracts"
import type { PrivacyRepository } from "../application/ports.js"
import type { Database } from "../../../shared/infrastructure/database.js"

const acceptanceSelect = {
  termsVersion: true,
  privacyVersion: true,
  acceptedAt: true,
} as const
const requestSelect = {
  id: true,
  kind: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  response: true,
} as const
const accountSelect = { id: true, name: true, email: true, createdAt: true, phone: true, avatarUrl: true } as const
// Convert only selected public fields; hashes, secrets and other tenants never enter the export.
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

export class PrismaPrivacy implements PrivacyRepository {
  constructor(private readonly db: Database) {}
  profile(userId: string) {
    return this.db.snapshot(async (tx) => {
      const account = await tx.user.findFirst({
        where: { id: userId, active: true },
        select: accountSelect,
      })
      if (!account)
        throw new Failure("UNAUTHENTICATED", "Entre novamente para consultar seus dados.")
      const acceptance = await tx.legalAcceptance.findFirst({
        where: { userId },
        select: acceptanceSelect,
        orderBy: { acceptedAt: "desc" },
      })
      const requests = await tx.privacyRequest.findMany({
        where: { userId },
        select: requestSelect,
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      return privacyProfileSchema.parse(json({ account, acceptance, requests }))
    })
  }
  export(userId: string, generatedAt: Date) {
    return this.db.snapshot(async (tx) => {
      const account = await tx.user.findFirst({
        where: { id: userId, active: true },
        select: accountSelect,
      })
      if (!account)
        throw new Failure("UNAUTHENTICATED", "Entre novamente para consultar seus dados.")
      const acceptances = await tx.legalAcceptance.findMany({
        where: { userId },
        select: acceptanceSelect,
        orderBy: { acceptedAt: "desc" },
      })
      const requests = await tx.privacyRequest.findMany({
        where: { userId },
        select: requestSelect,
        orderBy: { createdAt: "desc" },
      })
      const memberships = await tx.membership.findMany({
        where: { userId },
        select: {
          tenantId: true,
          role: true,
          active: true,
          tenant: { select: { name: true } },
        },
      })
      const sessions = await tx.session.findMany({
        where: { userId },
        select: { createdAt: true, expiresAt: true, revokedAt: true },
      })
      const securityEvents = await tx.securityEvent.findMany({
        where: { actorUserId: userId },
        select: { action: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
      return privacyExportSchema.parse(
        json({
          generatedAt,
          account,
          acceptances,
          requests,
          memberships: memberships.map(({ tenant, ...m }) => ({
            ...m,
            tenantName: tenant.name,
          })),
          sessions,
          securityEvents,
        }),
      )
    })
  }
  accept(userId: string, input: LegalAcceptance, id: string, at: Date) {
    return this.db.run(async (client) => {
      await client.legalAcceptance.upsert({
        where: {
          userId_termsVersion_privacyVersion: {
            userId,
            termsVersion: input.termsVersion,
            privacyVersion: input.privacyVersion,
          },
        },
        create: {
          id,
          userId,
          termsVersion: input.termsVersion,
          privacyVersion: input.privacyVersion,
          acceptedAt: at,
        },
        update: {},
      })
    })
  }
  request(
    userId: string,
    input: Parameters<PrivacyRepository["request"]>[1],
    id: string,
    at: Date,
  ) {
    return this.db.run(async (client) =>
      privacyRequestSchema.parse(
        json(
          await client.privacyRequest.create({
            data: { id, userId, kind: input.kind, message: input.message, createdAt: at },
            select: requestSelect,
          }),
        ),
      ),
    )
  }
}
