import {
  saveCombo,
  savePromotion,
  saveDelivery,
  removeOffer,
} from "@cardapio/domain/commerce-changes"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { CommerceService } from "./ports"
import type { MenuRepository } from "../../catalog/application/ports"
import type { AccessPolicy } from "../../../shared/application/ports"
import type { Executor } from "../../../shared/application/execute"
export class LocalCommerce implements CommerceService {
  constructor(
    private readonly repository: MenuRepository,
    private readonly access: AccessPolicy,
    private readonly executor: Executor,
  ) {}
  private change(
    id: string,
    revision: number,
    apply: (menu: MenuDocument) => MenuDocument,
  ) {
    return this.executor.run("commerce", "save", async () => {
      this.access.assertAdmin()
      return this.repository.commit(id, revision, apply(await this.repository.load(id)))
    })
  }
  combo(...[id, revision, combo]: Parameters<CommerceService["combo"]>) {
    return this.change(id, revision, (m) => saveCombo(m, combo))
  }
  promotion(...[id, revision, promotion]: Parameters<CommerceService["promotion"]>) {
    return this.change(id, revision, (m) => savePromotion(m, promotion))
  }
  delivery(...[id, revision, delivery]: Parameters<CommerceService["delivery"]>) {
    return this.change(id, revision, (m) => saveDelivery(m, delivery))
  }
  remove(...[id, revision, kind, offerId]: Parameters<CommerceService["remove"]>) {
    return this.change(id, revision, (m) => removeOffer(m, kind, offerId))
  }
}
