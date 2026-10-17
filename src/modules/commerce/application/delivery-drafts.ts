import { z } from "zod"
import { deliverySettingsSchema, brazilianStates } from "@cardapio/contracts"
export const deliveryDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  delivery: deliverySettingsSchema.extend({ pickupEta: z.string().max(80) }),
})
export const zoneDraftSchema = z.strictObject({
  id: z.string().max(100),
  state: z.string().max(2),
  city: z.string().max(120),
  neighborhood: z.string().max(120),
  fee: z.string().max(20),
  etaMin: z.string().max(4),
  etaMax: z.string().max(4),
  active: z.boolean(),
  latitude: z.string().max(20),
  longitude: z.string().max(20),
  cep: z.string().max(9),
})
export const states = brazilianStates
