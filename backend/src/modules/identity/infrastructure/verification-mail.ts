import { createHmac, randomInt } from "node:crypto"
import { Failure } from "@cardapio/domain/failure"
import type { VerificationCodes, VerificationMail } from "../application/email-ports.js"
import { Bulkhead } from "../../../shared/application/bulkhead.js"

export class SecureEmailCodes implements VerificationCodes {
  constructor(private readonly secret: string) {}
  create() {
    return randomInt(0, 1_000_000).toString().padStart(6, "0")
  }
  hash(userId: string, code: string) {
    return createHmac("sha256", this.secret)
      .update(`email-verification:${userId}:${code}`)
      .digest("hex")
  }
}
export class SelfHostedVerificationMail implements VerificationMail {
  private readonly capacity = new Bulkhead(4)
  constructor(
    private readonly config: {
      provider: "disabled" | "postal" | "mailpit"
      url: string
      key: string
      from: string
    },
    private readonly transport: typeof fetch = fetch,
  ) {}
  async send(email: string, code: string) {
    if (this.config.provider === "disabled")
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "O envio de e-mail ainda não foi configurado.",
      )
    return this.capacity.run(async () => {
      const text = `Seu código de confirmação do Pede Aqui é: ${code}\n\nEle expira em 10 minutos e só pode ser usado uma vez. Não compartilhe este código.\n\nSe você não solicitou esta confirmação, ignore a mensagem.`
      const postal = this.config.provider === "postal"
      const response = await this.transport(
        this.config.url + (postal ? "/api/v1/send/message" : "/api/v1/send"),
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          headers: {
            "Content-Type": "application/json",
            ...(postal ? { "X-Server-API-Key": this.config.key } : {}),
          },
          body: JSON.stringify(
            postal
              ? {
                  from: this.config.from,
                  to: [email],
                  subject: "Confirme seu e-mail no Pede Aqui",
                  plain_body: text,
                  tag: "email-verification",
                }
              : {
                  From: { Email: this.config.from, Name: "Pede Aqui" },
                  To: [{ Email: email }],
                  Subject: "Confirme seu e-mail no Pede Aqui",
                  Text: text,
                },
          ),
        },
      )
      if (!response.ok)
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "O envio de e-mail está temporariamente indisponível.",
        )
      const body: unknown = await response.json()
      if (
        postal &&
        (!body ||
          typeof body !== "object" ||
          !("status" in body) ||
          body.status !== "success")
      )
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "O envio de e-mail não foi aceito. Tente novamente.",
        )
    })
  }
}
