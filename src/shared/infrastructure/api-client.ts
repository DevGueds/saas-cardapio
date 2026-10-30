import { z, type ZodType } from "zod"
import { errorSchema, type Result } from "@cardapio/contracts"
import { Failure } from "../domain/failure"
import type { Executor } from "../application/execute"
export class ApiClient {
  private csrf = ""
  private readonly expired = new Set<
    (reason?: "UNAUTHENTICATED" | "MFA_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED") => void
  >()
  constructor(
    private readonly base: unknown,
    private readonly executor: Executor,
  ) {}
  setCsrf(value: string) {
    this.csrf = value
  }
  subscribeExpired(
    listener: (
      reason?: "UNAUTHENTICATED" | "MFA_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED",
    ) => void,
  ) {
    this.expired.add(listener)
    return () => {
      this.expired.delete(listener)
    }
  }
  endpoint(path: string) {
    try {
      if (typeof this.base !== "string") throw new Error()
      const base = new URL(
        this.base === "/api/v1" ? `${window.location.origin}/api/v1` : this.base,
      )
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
      if (
        (base.protocol !== "https:" &&
          !(
            (local ||
              (this.base === "/api/v1" && base.origin === window.location.origin)) &&
            base.protocol === "http:"
          )) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        !base.pathname.endsWith("/api/v1")
      )
        throw new Error()
      return `${base.href}${path}`
    } catch {
      throw new Failure(
        "CONFIGURATION",
        "O endereço da API não foi configurado corretamente. Contate o responsável pelo sistema.",
      )
    }
  }
  async request<T>(
    path: string,
    schema: ZodType<T>,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: unknown
      idempotencyKey?: string
      trackingToken?: string
    } = {},
  ): Promise<Result<T>> {
    const outcome = await this.executor.run("http", "request", async () => {
      const url = this.endpoint(path)
      let response: Response
      try {
        response = await fetch(url, {
          method: options.method ?? "GET",
          credentials: "include",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
          headers: {
            ...(options.method && options.method !== "GET"
              ? { "Content-Type": "application/json" }
              : {}),
            ...(options.trackingToken ? { "X-Order-Token": options.trackingToken } : {}),
            ...(this.csrf ? { "X-CSRF-Token": this.csrf } : {}),
            ...(options.idempotencyKey
              ? { "Idempotency-Key": options.idempotencyKey }
              : {}),
          },
          ...(options.method && options.method !== "GET"
            ? { body: JSON.stringify(options.body ?? {}) }
            : {}),
        })
      } catch {
        throw new Failure(
          "STORAGE_UNAVAILABLE",
          "Não foi possível conectar à loja. Confira sua conexão e tente novamente; seus dados foram preservados.",
        )
      }
      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new Failure(
          "CORRUPT_DATA",
          "A API retornou uma resposta inválida. Tente novamente em instantes.",
        )
      }
      const result = z
        .discriminatedUnion("ok", [
          z.strictObject({ ok: z.literal(true), value: schema }),
          z.strictObject({ ok: z.literal(false), error: errorSchema }),
        ])
        .safeParse(body)
      if (!result.success || (!response.ok && result.data.ok))
        throw new Failure(
          "CORRUPT_DATA",
          "A resposta da API não pôde ser validada. Atualize os dados e tente novamente.",
        )
      if (
        !result.data.ok &&
        (result.data.error.code === "UNAUTHENTICATED" ||
          result.data.error.code === "MFA_REQUIRED" ||
          result.data.error.code === "EMAIL_VERIFICATION_REQUIRED") &&
        path !== "/auth/login"
      ) {
        if (result.data.error.code === "UNAUTHENTICATED") this.csrf = ""
        const reason = result.data.error.code
        this.expired.forEach((listener) => listener(reason))
      }
      return result.data as Result<T>
    })
    return outcome.ok ? outcome.value : outcome
  }
}
