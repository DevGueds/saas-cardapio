import {
  saveComboSchema,
  savePromotionSchema,
  saveDeliverySchema,
  deleteSchema,
  uuid,
} from "@cardapio/contracts"
import {
  saveCombo,
  savePromotion,
  saveDelivery,
  removeOffer,
} from "@cardapio/domain/commerce-changes"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Actor } from "../../identity/domain/identity.js"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type { MenuRepository } from "../../catalog/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
export class CommerceManagement {
  constructor(
    private readonly menus: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly operation: Operation,
  ) {}
  private async commit(
    actor: Actor,
    id: string,
    revision: number,
    change: (menu: MenuDocument) => MenuDocument,
  ) {
    const scope = await this.access.restaurant(actor, id, "catalog:write")
    return this.menus.commit(scope, revision, change(await this.menus.load(scope)))
  }
  combo(actor: Actor, id: string, input: unknown) {
    return this.operation.run("commerce.combo", async () => {
      const data = validate(saveComboSchema, input)
      return this.commit(actor, id, data.expectedRevision, (m) =>
        saveCombo(m, data.combo),
      )
    })
  }
  promotion(actor: Actor, id: string, input: unknown) {
    return this.operation.run("commerce.promotion", async () => {
      const data = validate(savePromotionSchema, input)
      return this.commit(actor, id, data.expectedRevision, (m) =>
        savePromotion(m, data.promotion),
      )
    })
  }
  delivery(actor: Actor, id: string, input: unknown) {
    return this.operation.run("commerce.delivery", async () => {
      const data = validate(saveDeliverySchema, input)
      return this.commit(actor, id, data.expectedRevision, (m) =>
        saveDelivery(m, data.delivery),
      )
    })
  }
  remove(
    actor: Actor,
    id: string,
    kind: "combos" | "promotions",
    offerId: string,
    input: unknown,
  ) {
    return this.operation.run("commerce.remove", async () => {
      const data = validate(deleteSchema, input),
        offer = validate(uuid, offerId)
      return this.commit(actor, id, data.expectedRevision, (m) =>
        removeOffer(m, kind, offer),
      )
    })
  }
}
