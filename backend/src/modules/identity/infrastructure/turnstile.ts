import { z } from "zod"
import { Failure } from "@cardapio/domain/failure"
import type { BotProtection } from "../application/email-ports.js"
import { Bulkhead } from "../../../shared/application/bulkhead.js"
const responseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
})
export class Turnstile implements BotProtection {
  private readonly capacity = new Bulkhead(8)
  constructor(
    private readonly secret: string,
    private readonly hosts: string[],
    private readonly transport: typeof fetch = fetch,
  ) {}
  async verify(token: string | undefined, ip: string, action: "login" | "register") {
    if (!this.secret) return
    if (!token || token.length > 2048)
      throw new Failure(
        "VALIDATION",
        "Conclua a verificação de segurança para continuar.",
      )
    await this.capacity.run(async () => {
      let response: Response
      try {
        response = await this.transport(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret: this.secret, response: token, remoteip: ip }),
          },
        )
        if (!response.ok) throw new Error()
      } catch {
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "A verificação de segurança está indisponível. Tente novamente em instantes.",
        )
      }
      const data = responseSchema.safeParse(await response.json().catch(() => null))
      if (
        !data.success ||
        !data.data.success ||
        data.data.action !== action ||
        !this.hosts.includes(data.data.hostname ?? "")
      )
        throw new Failure(
          "VALIDATION",
          "A verificação de segurança expirou ou não foi aceita. Faça a verificação novamente.",
        )
    })
  }
}
