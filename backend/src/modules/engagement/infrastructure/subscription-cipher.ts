import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { pushSubscriptionSchema } from "@cardapio/contracts"
import type { PushInput } from "../application/ports.js"
export class SubscriptionCipher {
  private readonly key: Buffer
  constructor(secret: string) {
    this.key = createHash("sha256").update(`push-subscriptions:${secret}`).digest()
  }
  seal(value: PushInput) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv)
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ])
    return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".")
  }
  open(value: string): PushInput {
    const [iv, tag, data] = value.split(".").map((v) => Buffer.from(v, "base64url"))
    if (!iv || !tag || !data) throw new Error("invalid_subscription")
    const cipher = createDecipheriv("aes-256-gcm", this.key, iv)
    cipher.setAuthTag(tag)
    return pushSubscriptionSchema.parse(
      JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8")),
    )
  }
}
