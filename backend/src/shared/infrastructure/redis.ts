import { createClient } from "redis"
import { Failure } from "@cardapio/domain/failure"
import type { CacheStore } from "../application/cache.js"
import type { RequestLimiter, SecretTokens } from "../application/ports.js"
const increment = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`
export class RedisStore implements CacheStore {
  readonly client
  private pending = 0
  constructor(
    url: string,
    private readonly namespace: string,
  ) {
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 512,
      commandOptions: { timeout: 2000 },
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: (retries) =>
          Math.min(2000, 100 * 2 ** Math.min(retries, 5)) + Math.random() * 200,
      },
    })
    this.client.on("error", () => {
      /* Operations report sanitized errors; never log connection credentials. */
    })
  }
  async connect() {
    try {
      await Promise.race([
        this.client.connect(),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("redis_connect_timeout")), 4000)
          timer.unref()
        }),
      ])
    } catch {
      this.close()
      throw this.unavailable()
    }
  }
  private unavailable() {
    return new Failure(
      "STORAGE_UNAVAILABLE",
      "O serviço de proteção está indisponível. Tente novamente em instantes.",
      {},
      "redis_unavailable",
    )
  }
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (!this.client.isReady || this.pending >= 512) throw this.unavailable()
    this.pending++
    let timer: ReturnType<typeof setTimeout> | undefined
    const work = action().finally(() => {
      this.pending--
    })
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(this.unavailable()), 2000)
        }),
      ])
    } catch {
      throw this.unavailable()
    } finally {
      clearTimeout(timer)
    }
  }
  key(key: string) {
    return `${this.namespace}:${key}`
  }
  get(key: string) {
    return this.run(() => this.client.get(this.key(key)))
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.run(() => this.client.set(this.key(key), value, { EX: ttlSeconds }))
  }
  async delete(key: string) {
    await this.run(() => this.client.del(this.key(key)))
  }
  ping() {
    return this.run(() => this.client.ping())
  }
  close() {
    if (this.client.isOpen) this.client.destroy()
  }
}
export class RedisLimiter implements RequestLimiter {
  constructor(
    private readonly store: RedisStore,
    private readonly secrets: SecretTokens,
  ) {}
  async consume(key: string, maximum: number, windowSeconds: number) {
    const count = await this.store.run(() =>
      this.store.client.eval(increment, {
        keys: [this.store.key("limit:" + this.secrets.fingerprint(key))],
        arguments: [String(windowSeconds)],
      }),
    )
    if (typeof count !== "number")
      throw new Failure("CORRUPT_DATA", "Contador de proteção inválido.")
    if (count > maximum)
      throw new Failure(
        "RATE_LIMITED",
        "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      )
  }
}
