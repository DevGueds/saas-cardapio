import {
  availabilitySchema,
  deleteSchema,
  openSchema,
  saveProductSchema,
  updateSettingsSchema,
  uuid,
  updateHoursSchema,
} from "@cardapio/contracts"
import {
  saveProduct,
  changeAvailability,
  deleteProduct,
} from "@cardapio/domain/catalog-changes"
import {
  updateRestaurant,
  setRestaurantOpen,
  updateStoreHours,
} from "@cardapio/domain/restaurant-changes"
import { requireValid } from "@cardapio/domain/failure"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Actor } from "../../identity/domain/identity.js"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import type { Clock, IdGenerator } from "../../../shared/application/ports.js"
import { validate } from "../../../shared/application/validate.js"
import type { MenuRepository } from "./ports.js"
export class Catalog {
  constructor(
    private readonly menus: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly ids: IdGenerator,
    private readonly operation: Operation,
    private readonly publicMenus: { publicMenu(slug: string): Promise<MenuDocument> },
    private readonly clock: Clock,
  ) {}
  publicMenu(slug: string) {
    return this.operation.run("catalog.public-menu", async () => {
      requireValid(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80,
        "Endereço de cardápio inválido.",
      )
      return this.publicMenus.publicMenu(slug)
    })
  }
  adminMenu(actor: Actor, restaurantId: string) {
    return this.operation.run("catalog.admin-menu", async () =>
      this.menus.load(await this.access.restaurant(actor, restaurantId, "catalog:read")),
    )
  }
  private mutate(
    actor: Actor,
    restaurantId: string,
    expectedRevision: number,
    change: (menu: MenuDocument) => MenuDocument,
  ) {
    return this.access
      .restaurant(actor, restaurantId, "catalog:write")
      .then(async (scope) =>
        this.menus.commit(scope, expectedRevision, change(await this.menus.load(scope))),
      )
  }
  save(actor: Actor, restaurantId: string, input: unknown, productId?: string) {
    return this.operation.run("catalog.save-product", async () => {
      const data = validate(saveProductSchema, input)
      const id = productId === undefined ? undefined : validate(uuid, productId)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        saveProduct(menu, { ...data, ...(id ? { id } : {}) }, () => this.ids.next()),
      )
    })
  }
  availability(actor: Actor, restaurantId: string, productId: string, input: unknown) {
    return this.operation.run("catalog.availability", async () => {
      const data = validate(availabilitySchema, input)
      const id = validate(uuid, productId)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        changeAvailability(menu, id, data.available),
      )
    })
  }
  delete(actor: Actor, restaurantId: string, productId: string, input: unknown) {
    return this.operation.run("catalog.delete-product", async () => {
      const data = validate(deleteSchema, input)
      const id = validate(uuid, productId)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        deleteProduct(menu, id),
      )
    })
  }
  settings(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("restaurant.settings", async () => {
      const data = validate(updateSettingsSchema, input)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        updateRestaurant(menu, data),
      )
    })
  }
  open(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("restaurant.open", async () => {
      const data = validate(openSchema, input)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        setRestaurantOpen(menu, data.isOpen, this.clock.now().getTime()),
      )
    })
  }
  hours(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("restaurant.hours", async () => {
      const data = validate(updateHoursSchema, input)
      return this.mutate(actor, restaurantId, data.expectedRevision, (menu) =>
        updateStoreHours(menu, data.schedule, this.clock.now().getTime()),
      )
    })
  }
}
