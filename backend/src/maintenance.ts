import "dotenv/config"
import { loadConfig } from "./app/config.js"
import { Database } from "./shared/infrastructure/database.js"
import { Operation } from "./shared/application/operation.js"
import { clock, diagnostics, ids } from "./shared/infrastructure/runtime.js"
const operation = new Operation(diagnostics, ids, clock)
const result = await operation.run("maintenance.expired-records", async () => {
  const database = new Database(loadConfig(process.env))
  try {
    const now = clock.now()
    return await database.transaction(async (tx) => {
      const sessions = await tx.session.deleteMany({
        where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
      })
      const limits = await tx.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } })
      const emailCodes = await tx.emailVerificationChallenge.deleteMany({
        where: { expiresAt: { lte: now } },
      })
      const subscriptions = await tx.pushSubscription.deleteMany({
        where: { expiresAt: { lte: now } },
      })
      const events = await tx.notificationEvent.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - 30 * 86400000) } },
      })
      return {
        expiredSessions: sessions.count,
        expiredLimits: limits.count,
        expiredEmailCodes: emailCodes.count,
        expiredSubscriptions: subscriptions.count,
        expiredNotificationEvents: events.count,
      }
    })
  } finally {
    await database.close()
  }
})
if (result.ok) process.stdout.write(JSON.stringify(result.value) + "\n")
else process.exitCode = 1
