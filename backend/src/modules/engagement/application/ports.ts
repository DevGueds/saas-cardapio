import type { z } from "zod"
import type {
  BoardSnapshot,
  Inbox,
  Role,
  WhatsappState,
  DeliveryStatus,
  pushSubscriptionSchema,
} from "@cardapio/contracts"
import type { TenantScope } from "../../identity/domain/identity.js"
export interface ChannelRecord {
  revision: number
  boardEnabled: boolean
  boardVersion: string
  whatsappEnabled: boolean
}
export type PushInput = z.infer<typeof pushSubscriptionSchema>
export interface EngagementRepository {
  settings(scope: TenantScope): Promise<ChannelRecord>
  update(
    scope: TenantScope,
    revision: number,
    next: Omit<ChannelRecord, "revision">,
  ): Promise<ChannelRecord>
  board(scope: TenantScope): Promise<BoardSnapshot>
  orderAccess(
    scope: TenantScope,
    id: string,
    hash: string,
    now: Date,
  ): Promise<{ whatsapp: boolean }>
  consent(scope: TenantScope, id: string, consent: boolean, now: Date): Promise<void>
  subscribe(
    scope: TenantScope,
    recipient: { userId: string; sessionId: string } | { orderId: string },
    input: PushInput | null,
    endpoint: string,
    now: Date,
  ): Promise<void>
  inbox(scope: TenantScope, userId: string, role: Role): Promise<Inbox>
  read(scope: TenantScope, userId: string, before: Date): Promise<void>
  deliveries(scope: TenantScope): Promise<DeliveryStatus[]>
}
export interface WhatsappProvider {
  readonly configured: boolean
  state(scope: TenantScope): Promise<WhatsappState>
  connect(scope: TenantScope): Promise<WhatsappState>
  disconnect(scope: TenantScope): Promise<void>
  send(
    scope: TenantScope,
    phone: string,
    message: string,
  ): Promise<"SENT" | "FAILED" | "UNKNOWN">
}
