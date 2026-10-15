import { Failure } from "@cardapio/domain/failure"
import type { Clock, RequestLimiter, SecretTokens } from "../application/ports.js"
import type { Database } from "./database.js"

export class PrismaLimiter implements RequestLimiter {
  constructor(
    private readonly db: Database,
    private readonly secrets: SecretTokens,
    private readonly clock: Clock,
  ) {}
  async consume(input: string, maximum: number, windowSeconds: number) {
    const key = this.secrets.fingerprint(input)
    const now = this.clock.now()
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000)
    const count = await this.db.transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO RateLimit (\`key\`, count, expiresAt) VALUES (${key}, 1, ${expiresAt})
        ON DUPLICATE KEY UPDATE count = IF(expiresAt <= ${now}, 1, count + 1),
        expiresAt = IF(expiresAt <= ${now}, ${expiresAt}, expiresAt)
      `
      return (
        await tx.rateLimit.findUniqueOrThrow({ where: { key }, select: { count: true } })
      ).count
    })
    if (count > maximum)
      throw new Failure(
        "RATE_LIMITED",
        "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      )
  }
}
