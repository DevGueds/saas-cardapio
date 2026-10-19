import type { Combo, Promotion, DeliverySettings } from "@cardapio/domain/commerce"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import type { Result, PostalAddress } from "@cardapio/contracts"
import type { AddonGroup, MenuAppearance } from "@cardapio/domain/menu-options"
export interface CommerceService {
  addon(id: string, revision: number, group: AddonGroup): Promise<Result<MenuDocument>>
  appearance(
    id: string,
    revision: number,
    appearance: MenuAppearance,
  ): Promise<Result<MenuDocument>>
  removeAddon(
    id: string,
    revision: number,
    groupId: string,
  ): Promise<Result<MenuDocument>>
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
