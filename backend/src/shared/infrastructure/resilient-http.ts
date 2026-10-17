import { Failure } from "@cardapio/domain/failure"
import { Bulkhead } from "../application/bulkhead.js"
/** One instance per upstream. Only GET is exposed: writes must not be retried implicitly. */
export class ResilientHttp {
  private failures = 0
  private openUntil = 0
  private probing = false
  private readonly bulkhead: Bulkhead
  constructor(
    private readonly options: {
      timeoutMs: number
      concurrency: number
      failureThreshold: number
      cooldownMs: number
    },
    private readonly transport: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.bulkhead = new Bulkhead(options.concurrency)
  }
  async getJson(url: string): Promise<unknown> {
    if (this.openUntil > this.now() || this.probing) throw this.unavailable()
    const probe = this.failures >= this.options.failureThreshold
    if (probe) this.probing = true
    try {
      return await this.bulkhead.run(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await this.transport(url, {
              redirect: "error",
              signal: AbortSignal.timeout(this.options.timeoutMs),
              headers: { Accept: "application/json" },
            })
            if (response.status === 404) {
              await response.body?.cancel()
              this.failures = 0
              throw new Failure(
                "NOT_FOUND",
                "CEP não encontrado. Confira os números ou preencha o endereço manualmente.",
              )
            }
            if (!response.ok) {
              await response.body?.cancel()
              throw this.unavailable()
            }
            const reader = response.body?.getReader()
            if (!reader) throw this.unavailable()
            let body = "",
              size = 0
            const decoder = new TextDecoder()
            try {
              for (;;) {
                const chunk = await reader.read()
                if (chunk.done) break
                size += chunk.value.byteLength
                if (size > 64 * 1024) throw this.unavailable()
                body += decoder.decode(chunk.value, { stream: true })
              }
              body += decoder.decode()
            } finally {
              await reader.cancel()
            }
            const value: unknown = JSON.parse(body)
            this.failures = 0
            this.openUntil = 0
            return value
          } catch (error) {
            if (error instanceof Failure && error.code === "NOT_FOUND") throw error
            if (attempt === 1 || probe) {
              this.failures++
              if (this.failures >= this.options.failureThreshold)
                this.openUntil = this.now() + this.options.cooldownMs
              throw this.unavailable()
            }
            await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 150))
          }
        }
        throw this.unavailable()
      })
    } finally {
      if (probe) this.probing = false
    }
  }
  private unavailable() {
    return new Failure(
      "CAPABILITY_UNAVAILABLE",
      "A consulta de endereço está indisponível. Preencha os dados manualmente e selecione seu bairro.",
      {},
      "upstream_unavailable",
    )
  }
}
