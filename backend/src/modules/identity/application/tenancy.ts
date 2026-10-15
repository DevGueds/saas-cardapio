import {
  memberSchema,
  restaurantCreationSchema,
  tenantCreationSchema,
  uuid,
} from "@cardapio/contracts"
import type { IdGenerator } from "../../../shared/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { Actor } from "../domain/identity.js"
import type { AccessPolicy, AccessRepository } from "./ports.js"

export class Tenancy {
  constructor(
    private readonly repository: AccessRepository,
    private readonly access: AccessPolicy,
    private readonly ids: IdGenerator,
    private readonly operation: Operation,
  ) {}
  restaurants(actor: Actor) {
    return this.operation.run("tenancy.restaurants", async () => {
      await this.access.session(actor)
      return this.repository.restaurants(actor)
    })
  }
  create(actor: Actor, input: unknown) {
    return this.operation.run("tenancy.create", async () => {
      await this.access.session(actor)
      const data = validate(tenantCreationSchema, input)
      const tenantId = this.ids.next(),
        restaurantId = this.ids.next()
      await this.repository.createTenant(
        actor,
        { id: tenantId, name: data.name },
        { tenantId, restaurantId, name: data.restaurantName, slug: data.slug },
      )
      return { tenantId, restaurantId }
    })
  }
  createRestaurant(actor: Actor, tenantId: string, input: unknown) {
    return this.operation.run("tenancy.create-restaurant", async () => {
      await this.access.tenant(actor, tenantId, "catalog:write")
      const data = validate(restaurantCreationSchema, input)
      const restaurantId = this.ids.next()
      await this.repository.createRestaurant(tenantId, { id: restaurantId, ...data })
      return { restaurantId }
    })
  }
  members(actor: Actor, tenantId: string) {
    return this.operation.run("tenancy.members", async () => {
      await this.access.tenant(actor, tenantId, "members:write")
      return this.repository.members(tenantId)
    })
  }
  addMember(actor: Actor, tenantId: string, input: unknown) {
    return this.operation.run("tenancy.add-member", async () => {
      await this.access.tenant(actor, tenantId, "members:write")
      const data = validate(memberSchema, input)
      await this.repository.addMember(tenantId, data.email, data.role)
      return null
    })
  }
  removeMember(actor: Actor, tenantId: string, userId: string) {
    return this.operation.run("tenancy.remove-member", async () => {
      await this.access.tenant(actor, tenantId, "members:write")
      await this.repository.removeMember(tenantId, validate(uuid, userId))
      return null
    })
  }
}
