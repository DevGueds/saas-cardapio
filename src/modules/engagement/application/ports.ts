import type { z } from "zod"
import type {
  Result,
  BoardSnapshot,
  ChannelSettings,
  Inbox,
  WhatsappState,
  DeliveryStatus,
  boardDeltaSchema,
  pushSubscriptionSchema,
} from "@cardapio/contracts"
export type PushTarget =
  { restaurantId: string } | { slug: string; orderId: string; token: string }
export interface EngagementService {
  settings(id: string): Promise<Result<ChannelSettings>>
  update(
    id: string,
    input: {
      expectedRevision: number
      boardEnabled: boolean
      whatsappEnabled: boolean
      rotateBoard: boolean
    },
  ): Promise<Result<ChannelSettings>>
  board(
    slug: string,
    token: string,
    callbacks: {
      snapshot(value: BoardSnapshot): void
      delta(value: z.infer<typeof boardDeltaSchema>): void
      status(connected: boolean, message: string): void
    },
    signal: AbortSignal,
  ): Promise<void>
  inbox(id: string): Promise<Result<Inbox>>
  read(id: string, before: string): Promise<Result<void>>
  whatsapp(
    id: string,
    action: "state" | "connect" | "disconnect",
  ): Promise<Result<WhatsappState>>
  deliveries(id: string): Promise<Result<DeliveryStatus[]>>
  pushConfiguration(): Promise<Result<{ enabled: boolean; publicKey: string }>>
  push(
    target: PushTarget,
    subscription: z.infer<typeof pushSubscriptionSchema> | { endpoint: string },
    remove?: boolean,
  ): Promise<Result<void>>
  preferences(
    target: Extract<PushTarget, { slug: string }>,
  ): Promise<Result<{ whatsapp: boolean; available: boolean }>>
  consent(
    target: Extract<PushTarget, { slug: string }>,
    whatsapp: boolean,
  ): Promise<Result<void>>
}
