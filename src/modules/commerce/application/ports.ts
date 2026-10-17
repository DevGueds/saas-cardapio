import type { Combo, Promotion, DeliverySettings } from "@cardapio/domain/commerce"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Result, PostalAddress } from "@cardapio/contracts"
export interface CommerceService {
  combo(id: string, revision: number, combo: Combo): Promise<Result<MenuDocument>>
  promotion(
    id: string,
    revision: number,
    promotion: Omit<Promotion, "used">,
  ): Promise<Result<MenuDocument>>
  delivery(
    id: string,
    revision: number,
    delivery: DeliverySettings,
  ): Promise<Result<MenuDocument>>
  remove(
    id: string,
    revision: number,
    kind: "combos" | "promotions",
    offerId: string,
  ): Promise<Result<MenuDocument>>
}
export interface MapsService {
  lookup(cep: string): Promise<Result<PostalAddress>>
  configuration(): Promise<Result<{ mapTileUrl?: string }>>
}
