import { visibleOrder } from "./order-visibility.js"
import {
  checkoutSchema,
  orderTransitionSchema,
  quoteRequestSchema,
  assignmentSchema,
  uuid,
} from "@cardapio/contracts"
import { validateCheckout } from "@cardapio/domain/checkout"
import { quoteOrder } from "@cardapio/domain/quote"
import { canAdvance } from "@cardapio/domain/permissions"
import { Failure, requireValid } from "@cardapio/domain/failure"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Actor } from "../../identity/domain/identity.js"
import type { MenuRepository } from "../../catalog/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import type {
  Clock,
  IdGenerator,
  RequestLimiter,
  SecretTokens,
} from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { OrdersRepository } from "./ports.js"
export class Orders {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly menus: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly operation: Operation,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly secrets: SecretTokens,
    private readonly limiter: RequestLimiter,
  ) {}
  private async publicScope(slug: string) {
    requireValid(
      slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      "Endereço de cardápio inválido.",
    )
    return this.menus.resolve(slug)
  }
  receipt(slug: string, key: unknown, ip: string) {
    return this.operation.run("orders.receipt", async () => {
      await this.limiter.consume("receipt:" + ip, 60, 60)
      const idempotencyKey = validate(uuid, key),
        scope = await this.publicScope(slug),
        receipt = await this.repository.receipt(scope, this.secrets.hash(idempotencyKey))
      return receipt
        ? {
            ...receipt,
            trackingToken: this.secrets.fingerprint(
              `tracking:${receipt.orderId!}:${idempotencyKey}`,
            ),
          }
        : null
    })
  }
  quote(slug: string, input: unknown, ip: string) {
    return this.operation.run("orders.quote", async () => {
      await this.limiter.consume("quote:" + ip, 120, 60)
      const data = validate(quoteRequestSchema, input),
        scope = await this.publicScope(slug),
        menu = await this.menus.load(scope)
      if (menu.revision !== data.expectedRevision)
        throw new Failure(
          "CONFLICT",
          "O cardápio mudou. Atualize os itens antes de continuar.",
        )
      requireValid(menu.restaurant.isOpen, "A loja está fechada.")
      return quoteOrder(menu, data.cart, data.options, this.clock.now().getTime())
    })
  }
  prepare(slug: string, input: unknown, ip: string) {
    return this.operation.run("orders.prepare", async () => {
      await this.limiter.consume("prepare:" + ip, 30, 60)
      const data = validate(checkoutSchema, input),
        scope = await this.publicScope(slug),
        menu = await this.menus.load(scope)
      const details = validateCheckout(
        menu,
        scope.restaurantId,
        data.expectedRevision,
        data.cart,
        data.details,
        { ...data.options, now: this.clock.now().getTime() },
      )
      return {
        url: `https://wa.me/${details.phone}?text=${encodeURIComponent(details.message)}`,
        revision: menu.revision,
      }
    })
  }
  create(slug: string, key: unknown, input: unknown, ip: string) {
    return this.operation.run("orders.create", async () => {
      await this.limiter.consume("order:" + ip, 20, 900)
      const data = validate(checkoutSchema, input),
        idempotencyKey = validate(uuid, key),
        scope = await this.publicScope(slug)
      const trackingToken = (id: string) =>
        this.secrets.fingerprint(`tracking:${id}:${idempotencyKey}`)
      const receipt = await this.repository.create(
        scope,
        {
          idempotencyHash: this.secrets.hash(idempotencyKey),
          payloadHash: this.secrets.fingerprint(JSON.stringify(data)),
        },
        (menu) => {
          const now = this.clock.now(),
            checkout = validateCheckout(
              menu,
              scope.restaurantId,
              data.expectedRevision,
              data.cart,
              data.details,
              { ...data.options, requireWhatsapp: false, now: now.getTime() },
            )
          const id = this.ids.next(),
            quote = checkout.quote
          return {
            checkoutRevision: menu.revision,
            whatsappUrl: checkout.phone
              ? `https://wa.me/${checkout.phone}?text=${encodeURIComponent(checkout.message)}`
              : "",
            trackingHash: this.secrets.hash(trackingToken(id)),
            trackingExpiresAt: new Date(now.getTime() + 30 * 86400000),
            whatsappConsentAt: data.options?.whatsappConsent ? now : null,
            order: {
              id,
              restaurantId: scope.restaurantId,
              revision: 0,
              status: "NEW",
              createdAt: now.toISOString(),
              customer: checkout.customer,
              ...quote,
              courierId: null,
              history: [{ status: "NEW", at: now.toISOString() }],
            },
          }
        },
      )
      return { ...receipt, trackingToken: trackingToken(receipt.orderId!) }
    })
  }
  track(slug: string, id: string, token: unknown, ip: string) {
    return this.operation.run("orders.track", async () => {
      await this.limiter.consume("track:" + ip, 120, 60)
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        throw new Failure(
          "NOT_FOUND",
          "Acompanhamento indisponível. Use o link completo do pedido.",
        )
      return this.repository.track(
        await this.publicScope(slug),
        validate(uuid, id),
        this.secrets.hash(token),
        this.clock.now(),
      )
    })
  }
  list(actor: Actor, restaurantId: string, cursor?: string) {
    return this.operation.run("orders.list", async () => {
      const { scope, role } = await this.access.grant(actor, restaurantId, "orders:read")
      const page = await this.repository.list(
        scope,
        cursor === undefined ? undefined : validate(uuid, cursor),
        { userId: actor.userId, role },
      )
      return { ...page, items: page.items.map((order) => visibleOrder(order, role)) }
    })
  }
  transition(actor: Actor, restaurantId: string, orderId: string, input: unknown) {
    return this.operation.run("orders.transition", async () => {
      const { scope, role } = await this.access.grant(
          actor,
          restaurantId,
          "orders:write",
        ),
        data = validate(orderTransitionSchema, input)
      if (!canAdvance(role, data.status))
        throw new Failure("ACCESS_DENIED", "Seu perfil não pode executar esta etapa.")
      const order = await this.repository.transition(
        scope,
        validate(uuid, orderId),
        data.expectedRevision,
        data.status,
        { userId: actor.userId, role },
        this.clock.now(),
      )
      return visibleOrder(order, role)
    })
  }
  couriers(actor: Actor, restaurantId: string) {
    return this.operation.run("orders.couriers", async () =>
      this.repository.couriers(
        await this.access.restaurant(actor, restaurantId, "orders:dispatch"),
      ),
    )
  }
  assign(actor: Actor, restaurantId: string, orderId: string, input: unknown) {
    return this.operation.run("orders.assign", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "orders:dispatch"),
        data = validate(assignmentSchema, input)
      return this.repository.assign(
        scope,
        validate(uuid, orderId),
        data.expectedRevision,
        data.courierId,
      )
    })
  }
}
