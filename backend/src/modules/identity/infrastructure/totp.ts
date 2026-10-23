import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { generateSecret, generateURI, verify } from "otplib"
import QRCode from "qrcode"
import type { MfaCryptography } from "../application/mfa-ports.js"
export class Totp implements MfaCryptography {
  private readonly key: Buffer
  constructor(secret: string) {
    this.key = createHash("sha256").update(`identity-mfa:v1:${secret}`).digest()
  }
  async setup(userId: string, label: string) {
    const secret = generateSecret(),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv)
    cipher.setAAD(Buffer.from(userId))
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
    const encrypted = [iv, cipher.getAuthTag(), ciphertext]
      .map((value) => value.toString("base64url"))
      .join(".")
    const uri = generateURI({ issuer: "Cardápio", label, secret })
    return {
      secret,
      encrypted,
      qr: await QRCode.toDataURL(uri, {
        errorCorrectionLevel: "M",
        width: 280,
        margin: 4,
      }),
    }
  }
  async counter(userId: string, encrypted: string, code: string, now: Date) {
    if (!/^\d{6}$/.test(code)) return null
    const [iv, tag, ciphertext] = encrypted
      .split(".")
      .map((value) => Buffer.from(value, "base64url"))
    if (!iv || !tag || !ciphertext) throw new Error("invalid_mfa_secret")
    const cipher = createDecipheriv("aes-256-gcm", this.key, iv)
    cipher.setAAD(Buffer.from(userId))
    cipher.setAuthTag(tag)
    const secret = Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString(
      "utf8",
    )
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(now.getTime() / 1000),
      epochTolerance: 30,
    })
    return result.valid && "epoch" in result && result.epoch !== undefined
      ? Math.floor(result.epoch / 30)
      : null
  }
  recoveryCodes() {
    return Array.from({ length: 10 }, () => randomBytes(12).toString("hex"))
  }
}
