import type { DraftManager } from "../../../shared/application/drafts"
import type { ContentFingerprint, IdGenerator } from "../../../shared/application/ports"
import { z } from "zod"
import { preparedOrderSchema } from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import type { Executor } from "../../../shared/application/execute"
import { Failure } from "../../../shared/domain/failure"
import type { PrepareOrder } from "../application/prepare-order"
const attemptSchema = z.strictObject({
  signature: z.string().regex(/^[a-f0-9]{64}$/),
  key: z.uuid(),
})
export class HttpCheckout {
  constructor(
    private readonly client: ApiClient,
    private readonly slug: (id: string) => string | undefined,
    private readonly executor: Executor,
    private readonly drafts: DraftManager,
    private readonly ids: IdGenerator,
    private readonly fingerprint: ContentFingerprint,
  ) {}
  reset(id: string) {
    this.drafts.clear(`api:customer:${id}:attempt`)
  }
  hasPending(id: string) {
    return !!this.drafts.snapshot(`api:customer:${id}:attempt`)
  }
  async recover(id: string) {
    const result = await this.executor.run("checkout", "recover-order", async () => {
      const saved = this.drafts.snapshot(`api:customer:${id}:attempt`)
      if (!saved) return { ok: true as const, value: null }
      const attempt = attemptSchema.safeParse(saved.value),
        slug = this.slug(id)
      if (!attempt.success || saved.issue)
        throw new Failure(
          "CONFLICT",
          "A tentativa salva não pôde ser validada. Confira o pedido com a loja antes de liberar outra tentativa.",
        )
      if (!slug)
        throw new Failure(
          "NOT_FOUND",
          "Atualize os dados da loja antes de recuperar o pedido.",
        )
      return this.client.request(
        `/public/restaurants/${encodeURIComponent(slug)}/checkout/attempt`,
        preparedOrderSchema.nullable(),
        { idempotencyKey: attempt.data.key },
      )
    })
    return result.ok ? result.value : result
  }
  async execute(
    ...[id, expectedRevision, cart, details, options]: Parameters<PrepareOrder["execute"]>
  ) {
    const result = await this.executor.run("checkout", "create-order", async () => {
      const slug = this.slug(id)
      if (!slug)
        throw new Failure(
          "NOT_FOUND",
          "Atualize os dados da loja antes de enviar o pedido.",
        )
      const body = { expectedRevision, cart, details, ...(options ? { options } : {}) }
      const signature = await this.fingerprint.digest(JSON.stringify(body))
      const draftKey = `api:customer:${id}:attempt`,
        saved = this.drafts.snapshot(draftKey)
      const parsed = attemptSchema.safeParse(saved?.value)
      if (saved && (!parsed.success || saved.issue))
        throw new Failure(
          "CONFLICT",
          "Uma tentativa de envio está pendente ou mudou em outra aba. Confira seus pedidos antes de tentar novamente.",
        )
      if (parsed.success) {
        const previous = await this.client.request(
          `/public/restaurants/${encodeURIComponent(slug)}/checkout/attempt`,
          preparedOrderSchema.nullable(),
          { idempotencyKey: parsed.data.key },
        )
        if (!previous.ok) return previous
        if (previous.value)
          return {
            ok: true as const,
            value: { ...previous.value, recovered: parsed.data.signature !== signature },
          }
        if (parsed.data.signature !== signature)
          throw new Failure(
            "CONFLICT",
            "O resultado do envio anterior ainda é incerto. Preserve os dados originais e tente novamente ou confirme com a loja antes de iniciar outro pedido.",
          )
      }
      const attempt = parsed.success ? parsed.data : { signature, key: this.ids.next() }
      if (!this.drafts.set(draftKey, attempt))
        throw new Failure(
          "STORAGE_UNAVAILABLE",
          "Não foi possível preservar a tentativa do pedido. Habilite o armazenamento do navegador e tente novamente.",
        )
      const sent = await this.client.request(
        `/public/restaurants/${encodeURIComponent(slug)}/orders`,
        preparedOrderSchema,
        { method: "POST", body, idempotencyKey: attempt.key },
      )
      if (
        !sent.ok &&
        ["VALIDATION", "CONFLICT", "NOT_FOUND", "RATE_LIMITED", "ACCESS_DENIED"].includes(
          sent.error.code,
        )
      )
        this.reset(id)
      return sent
    })
    return result.ok ? result.value : result
  }
}
