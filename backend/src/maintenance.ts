import "dotenv/config"
import { loadConfig } from "./app/config.js"
import { Operation } from "./shared/application/operation.js"
import { Database } from "./shared/infrastructure/database.js"
import { clock, diagnostics, ids } from "./shared/infrastructure/runtime.js"

const operation = new Operation(diagnostics, ids, clock)

const result = await operation.run("maintenance.expired-records", async () => {
  const database = new Database(loadConfig(process.env))
  try {
    const now = clock.now()
    return await database.transaction(async (tx) => {
      // Deleta sessões revogadas ou expiradas
      const sessions = await tx.session.deleteMany({
        where: { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] },
      })
      
      // Deleta bloqueios de Rate Limit cuja janela temporal já expirou no Postgres
      const limits = await tx.rateLimit.deleteMany({
        where: { expiresAt: { lte: now } },
      })

      return { expiredSessions: sessions.count, expiredLimits: limits.count }
    })
  } finally {
    await database.close()
  }
})

if (result.ok) {
  process.stdout.write(JSON.stringify(result.value) + "\n")
} else {
  process.exitCode = 1
}