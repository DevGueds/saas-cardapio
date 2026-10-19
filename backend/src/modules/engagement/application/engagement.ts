import { z } from "zod"
import {
  uuid,
  updateChannelsSchema,
  pushSubscriptionSchema,
  customerConsentSchema,
} from "@cardapio/contracts"
import { Failure, requireValid } from "@cardapio/domain/failure"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Actor, TenantScope } from "../../identity/domain/identity.js"
import type { MenuRepository } from "../../catalog/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import type {
  SecretTokens,
  Clock,
  IdGenerator,
  RequestLimiter,
} from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { EngagementRepository, WhatsappProvider, ChannelRecord } from "./ports.js"
export class Engagement {
  constructor(
    private readonly repository: EngagementRepository,
    private readonly menus: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly operation: Operation,
    private readonly secrets: SecretTokens,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly limiter: RequestLimiter,
    private readonly whatsapp: WhatsappProvider,
    private readonly pushKey: string,
  ) {}
  private view(scope: TenantScope, settings: ChannelRecord) {
    return {
      revision: settings.revision,
      boardEnabled: settings.boardEnabled,
      whatsappEnabled: settings.whatsappEnabled,
      whatsappConfigured: this.whatsapp.configured,
      boardToken: this.secrets.fingerprint(
        `board:${scope.tenantId}:${scope.restaurantId}:${settings.boardVersion}`,
      ),
    }
  }
  settings(actor: Actor, id: string) {
    return this.operation.run("engagement.settings", async () => {
      const scope = await this.access.restaurant(
        actor,
        validate(uuid, id),
        "catalog:write",
      )
      return this.view(scope, await this.repository.settings(scope))
    })
  }
  update(actor: Actor, id: string, input: unknown) {
    return this.operation.run("engagement.update", async () => {
      const scope = await this.access.restaurant(
          actor,
          validate(uuid, id),
          "catalog:write",
        ),
        data = validate(updateChannelsSchema, input),
        old = await this.repository.settings(scope)
      requireValid(
        !data.whatsappEnabled || this.whatsapp.configured,
        "Configure o provedor de WhatsApp antes de ativar os envios.",
      )
      if (data.whatsappEnabled && !old.whatsappEnabled)
        requireValid(
          (await this.whatsapp.state(scope)).state === "connected",
          "Conecte o WhatsApp da loja antes de ativar os envios.",
        )
      return this.view(
        scope,
        await this.repository.update(scope, data.expectedRevision, {
          boardEnabled: data.boardEnabled,
          whatsappEnabled: data.whatsappEnabled,
          boardVersion: data.rotateBoard ? this.ids.next() : old.boardVersion,
        }),
      )
    })
  }
  board(slug: string, token: unknown) {
    return this.operation.run("engagement.board", async () => {
      requireValid(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80,
        "Endereço do painel inválido.",
      )
      const scope = await this.menus.resolve(slug),
        settings = await this.repository.settings(scope),
        expected = this.view(scope, settings).boardToken
      if (
        !settings.boardEnabled ||
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        !this.secrets.equalHash(token, this.secrets.hash(expected))
      )
        throw new Failure(
          "NOT_FOUND",
          "Painel desativado ou link expirado. Solicite um novo link à loja.",
        )
      return this.repository.board(scope)
    })
  }
  configuration() {
    return { enabled: !!this.pushKey, publicKey: this.pushKey }
  }
  private async customer(slug: string, id: string, token: unknown, ip: string) {
    await this.limiter.consume(`preferences:${ip}`, 60, 60)
    requireValid(
      slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      "Loja inválida.",
    )
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new Failure("NOT_FOUND", "Use o link completo de acompanhamento do pedido.")
    const scope = await this.menus.resolve(slug)
    const preferences = await this.repository.orderAccess(
      scope,
      validate(uuid, id),
      this.secrets.hash(token),
      this.clock.now(),
    )
    return { scope, preferences }
  }
  customerPreferences(slug: string, id: string, token: unknown, ip: string) {
    return this.operation.run("engagement.preferences", async () => {
      const { scope, preferences } = await this.customer(slug, id, token, ip)
      const settings = await this.repository.settings(scope)
      return {
        ...preferences,
        available: settings.whatsappEnabled && this.whatsapp.configured,
      }
    })
  }
  consent(slug: string, id: string, token: unknown, ip: string, input: unknown) {
    return this.operation.run("engagement.consent", async () => {
      const { scope } = await this.customer(slug, id, token, ip),
        data = validate(customerConsentSchema, input)
      await this.repository.consent(scope, id, data.whatsapp, this.clock.now())
      return undefined
    })
  }
  customerPush(
    slug: string,
    id: string,
    token: unknown,
    ip: string,
    input: unknown,
    remove = false,
  ) {
    return this.operation.run("engagement.customer-push", async () => {
      const { scope } = await this.customer(slug, id, token, ip)
      await this.subscription(scope, { orderId: id }, input, remove)
      return undefined
    })
  }
  staffPush(actor: Actor, id: string, input: unknown, remove = false) {
    return this.operation.run("engagement.staff-push", async () => {
      const scope = await this.access.restaurant(actor, validate(uuid, id), "orders:read")
      await this.subscription(
        scope,
        { userId: actor.userId, sessionId: actor.sessionId },
        input,
        remove,
      )
      return undefined
    })
  }
  private async subscription(
    scope: TenantScope,
    recipient: { userId: string; sessionId: string } | { orderId: string },
    input: unknown,
    remove: boolean,
  ) {
    requireValid(
      remove || !!this.pushKey,
      "O Web Push ainda não foi configurado neste ambiente.",
    )
    const subscription = remove ? null : validate(pushSubscriptionSchema, input),
      endpoint =
        subscription?.endpoint ??
        validate(z.strictObject({ endpoint: z.string().url().max(2048) }), input).endpoint
    const url = new URL(endpoint)
    const allowed =
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".push.apple.com") ||
      url.hostname.endsWith(".notify.windows.com")
    requireValid(
      allowed &&
        url.protocol === "https:" &&
        (!url.port || url.port === "443") &&
        !url.username &&
        !url.password &&
        !url.hash,
      "Serviço de push não reconhecido. Use um navegador compatível atualizado.",
    )
    await this.repository.subscribe(
      scope,
      recipient,
      subscription,
      endpoint,
      this.clock.now(),
    )
  }
  inbox(actor: Actor, id: string) {
    return this.operation.run("engagement.inbox", async () => {
      const { scope, role } = await this.access.grant(
        actor,
        validate(uuid, id),
        "orders:read",
      )
      return this.repository.inbox(scope, actor.userId, role)
    })
  }
  read(actor: Actor, id: string, input: unknown) {
    return this.operation.run("engagement.read", async () => {
      const scope = await this.access.restaurant(
          actor,
          validate(uuid, id),
          "orders:read",
        ),
        data = validate(z.strictObject({ before: z.iso.datetime() }), input)
      const before = new Date(data.before)
      requireValid(before <= this.clock.now(), "Data de leitura inválida.")
      await this.repository.read(scope, actor.userId, before)
      return undefined
    })
  }
  whatsappState(actor: Actor, id: string, action: "state" | "connect" | "disconnect") {
    return this.operation.run("engagement.whatsapp", async () => {
      const scope = await this.access.restaurant(
        actor,
        validate(uuid, id),
        "catalog:write",
      )
      await this.limiter.consume(`whatsapp:${scope.restaurantId}`, 20, 60)
      if (action === "disconnect") {
        await this.whatsapp.disconnect(scope)
        return this.whatsapp.state(scope)
      }
      return this.whatsapp[action](scope)
    })
  }
  deliveries(actor: Actor, id: string) {
    return this.operation.run("engagement.deliveries", async () =>
      this.repository.deliveries(
        await this.access.restaurant(actor, validate(uuid, id), "catalog:write"),
      ),
    )
  }
}
