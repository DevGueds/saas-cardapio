import { preparedOrderSchema } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { Executor } from "../../../shared/application/execute"
import { Failure } from "../../../shared/domain/failure"
import type { PrepareOrder } from "../application/prepare-order"
export class HttpCheckout {
  private readonly attempts = new Map<string, { signature: string; key: string }>()
  constructor(
    private readonly client: ApiClient,
    private readonly slug: (id: string) => string | undefined,
    private readonly executor: Executor,
  ) {}
  reset(id: string) {
    this.attempts.delete(id)
  }
  async execute(
    ...[id, expectedRevision, cart, details]: Parameters<PrepareOrder["execute"]>
  ) {
    const result = await this.executor.run("checkout", "create-order", async () => {
      const slug = this.slug(id)
      if (!slug)
        throw new Failure(
          "NOT_FOUND",
          "Atualize os dados da loja antes de enviar o pedido.",
        )
      const body = { expectedRevision, cart, details }
      const signature = JSON.stringify(body)
      let attempt = this.attempts.get(id)
      if (!attempt || attempt.signature !== signature) {
        attempt = { signature, key: crypto.randomUUID() }
        this.attempts.set(id, attempt)
      }
      return this.client.request(
        `/public/restaurants/${encodeURIComponent(slug)}/orders`,
        preparedOrderSchema,
        { method: "POST", body, idempotencyKey: attempt.key },
      )
    })
    return result.ok ? result.value : result
  }
}
