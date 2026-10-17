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
    try {
      const key = this.secrets.fingerprint(input)
      const now = this.clock.now()
      const expiresAt = new Date(now.getTime() + windowSeconds * 1000)

      const count = await this.db.transaction(async (tx: any) => {
        await tx.$executeRaw`
          INSERT INTO "RateLimit" (key, count, "expiresAt") 
          VALUES (${key}, 1, ${expiresAt})
          ON CONFLICT (key) DO UPDATE SET 
            count = CASE 
              WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 
              ELSE "RateLimit".count + 1 
            END,
            "expiresAt" = CASE 
              WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt} 
              ELSE "RateLimit"."expiresAt" 
            END
        `

        // Suporta tanto tx.rateLimit quanto tx.RateLimit
        const model = tx.rateLimit ?? tx.RateLimit
        if (!model) return 1

        const record = await model.findUnique({
          where: { key },
          select: { count: true },
        })

        return record?.count ?? 1
      })

      if (count > maximum) {
        throw new Failure(
          "RATE_LIMITED",
          "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        )
      }
    } catch (cause) {
      if (cause instanceof Failure) throw cause
      // Não derruba a requisição em caso de falha de rate limit no dev
    }
  }
}