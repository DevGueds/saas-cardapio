import { Bulkhead } from "../application/bulkhead.js"
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto"
import * as argon2 from "argon2"
import type {
  Clock,
  DiagnosticLogger,
  IdGenerator,
  PasswordHasher,
  SecretTokens,
} from "../application/ports.js"

export const ids: IdGenerator = { next: randomUUID }
export const clock: Clock = { now: () => new Date() }
export const diagnostics: DiagnosticLogger = {
  record: (event) => process.stderr.write(JSON.stringify(event) + "\n"),
}

export class NodeSecrets implements SecretTokens {
  constructor(private readonly secret: string) {}
  create() {
    return randomBytes(32).toString("base64url")
  }
  hash(value: string) {
    return createHash("sha256").update(value).digest("hex")
  }
  csrf(token: string) {
    return createHmac("sha256", this.secret).update("csrf:").update(token).digest("hex")
  }
  fingerprint(value: string) {
    return createHmac("sha256", this.secret)
      .update("fingerprint:")
      .update(value)
      .digest("hex")
  }
  equalHash(value: string, expected: string) {
    const actual = Buffer.from(this.hash(value), "hex")
    const target = Buffer.from(expected, "hex")
    return actual.length === target.length && timingSafeEqual(actual, target)
  }
}
export class ArgonPasswords implements PasswordHasher {
  private readonly capacity = new Bulkhead(4)
  private constructor(public readonly dummyHash: string) {}
  static async create() {
    return new ArgonPasswords(
      await ArgonPasswords.encode(randomBytes(32).toString("hex")),
    )
  }
  private static encode(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    })
  }
  hash(password: string) {
    return this.capacity.run(() => ArgonPasswords.encode(password))
  }
  async verify(hash: string, password: string) {
    return this.capacity.run(async () => {
      try {
        return await argon2.verify(hash, password)
      } catch {
        return false
      }
    })
  }
}
