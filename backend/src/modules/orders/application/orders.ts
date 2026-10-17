import { checkoutSchema, orderTransitionSchema, uuid } from "@cardapio/contracts"
import { validateCheckout } from "@cardapio/domain/checkout"
import { requireValid } from "@cardapio/domain/failure"
import type { Operation } from "../../../shared/application/operation.js"
import type {
  Clock,
  IdGenerator,
  RequestLimiter,
  SecretTokens,
} from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { MenuRepository } from "../../catalog/application/ports.js"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Actor } from "../../identity/domain/identity.js"
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
  prepare(slug: string, input: unknown, ip: string) {
    return this.operation.run("orders.prepare", async () => {
      await this.limiter.consume("prepare:" + ip, 30, 60)
      const data = validate(checkoutSchema, input)
      const scope = await this.publicScope(slug)
      const menu = await this.menus.load(scope)
      const details = validateCheckout(
        menu,
        scope.restaurantId,
        data.expectedRevision,
        data.cart,
        data.details,
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
      const data = validate(checkoutSchema, input)
      const idempotencyKey = validate(uuid, key)
      const scope = await this.publicScope(slug)
      return this.repository.create(
        scope,
        {
          idempotencyHash: this.secrets.hash(idempotencyKey),
          payloadHash: this.secrets.fingerprint(JSON.stringify(data)),
        },
        (menu) => {
          const checkout = validateCheckout(
            menu,
            scope.restaurantId,
            data.expectedRevision,
            data.cart,
            data.details,
            { requireWhatsapp: false },
          )
          return {
            checkoutRevision: menu.revision,
            whatsappUrl: checkout.phone
              ? `https://wa.me/${checkout.phone}?text=${encodeURIComponent(checkout.message)}`
              : "",
            order: {
              id: this.ids.next(),
              restaurantId: scope.restaurantId,
              revision: 0,
              status: "NEW",
              createdAt: this.clock.now().toISOString(),
              customer: checkout.customer,
              subtotal: checkout.subtotal,
              deliveryFee: menu.restaurant.deliveryFee,
              total: checkout.total,
              items: data.cart.lines.map((line) => ({
                ...line,
                name: menu.products.find((product) => product.id === line.productId)!
                  .name,
              })),
            },
          }
        },
      )
    })
  }
  list(actor: Actor, restaurantId: string, cursor?: string) {
    return this.operation.run("orders.list", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "orders:read")
      return this.repository.list(
        scope,
        cursor === undefined ? undefined : validate(uuid, cursor),
      )
    })
  }
  transition(actor: Actor, restaurantId: string, orderId: string, input: unknown) {
    return this.operation.run("orders.transition", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "orders:write")
      const data = validate(orderTransitionSchema, input)
      return this.repository.transition(
        scope,
        validate(uuid, orderId),
        data.expectedRevision,
        data.status,
      )
    })
  }
}
