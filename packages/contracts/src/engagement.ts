import { z } from "zod"
import { uuid, revision } from "./common.js"
export const boardOrderSchema = z.strictObject({
  id: uuid,
  status: z.enum(["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY"]),
  createdAt: z.iso.datetime(),
})
export type BoardOrder = z.infer<typeof boardOrderSchema>
export const boardSnapshotSchema = z.strictObject({
  name: z.string().max(120),
  orders: z.array(boardOrderSchema).max(500),
  truncated: z.boolean(),
})
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>
export const boardDeltaSchema = z.strictObject({
  upsert: z.array(boardOrderSchema).max(500),
  remove: z.array(uuid).max(500),
  name: z.string().max(120),
  truncated: z.boolean(),
})
export const channelSettingsSchema = z.strictObject({
  revision,
  boardEnabled: z.boolean(),
  boardToken: z.string().regex(/^[a-f0-9]{64}$/),
  whatsappEnabled: z.boolean(),
  whatsappConfigured: z.boolean(),
})
export type ChannelSettings = z.infer<typeof channelSettingsSchema>
export const updateChannelsSchema = z.strictObject({
  expectedRevision: revision,
  boardEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  rotateBoard: z.boolean().default(false),
})
export const pushSubscriptionSchema = z.strictObject({
  endpoint: z.string().url().max(2048),
  keys: z.strictObject({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{86,88}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22,24}={0,2}$/),
  }),
})
export const pushSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  publicKey: z.string().max(200),
})
export const customerConsentSchema = z.strictObject({ whatsapp: z.boolean() })
export const customerPreferencesSchema = z.strictObject({
  whatsapp: z.boolean(),
  available: z.boolean(),
})
export const notificationSchema = z.strictObject({
  id: uuid,
  orderId: uuid,
  kind: z.enum(["ORDER", "PAYMENT", "REVERSAL"]),
  title: z.string().max(160),
  message: z.string().max(500),
  createdAt: z.iso.datetime(),
})
export type NotificationView = z.infer<typeof notificationSchema>
export const inboxSchema = z.strictObject({
  items: z.array(notificationSchema).max(100),
  unread: z.number().int().min(0),
  readAt: z.iso.datetime(),
})
export type Inbox = z.infer<typeof inboxSchema>
export const whatsappStateSchema = z.strictObject({
  state: z.enum(["unconfigured", "disconnected", "connecting", "connected"]),
  qr: z.string().max(200000).nullable(),
})
export type WhatsappState = z.infer<typeof whatsappStateSchema>
export const deliveriesSchema = z
  .array(
    z.strictObject({
      id: uuid,
      orderId: uuid,
      channel: z.enum(["PUSH", "WHATSAPP"]),
      state: z.enum(["PENDING", "PROCESSING", "SENT", "FAILED", "UNKNOWN", "SKIPPED"]),
      attempts: z.number().int(),
      createdAt: z.iso.datetime(),
    }),
  )
  .max(100)
export type DeliveryStatus = z.infer<typeof deliveriesSchema>[number]
