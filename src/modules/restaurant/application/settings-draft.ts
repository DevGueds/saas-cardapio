import { z } from "zod"
export const settingsDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  name: z.string().max(120),
  description: z.string().max(1000),
  whatsapp: z.string().max(30),
  address: z.string().max(500),
  deliveryFee: z.string().max(20),
  minOrder: z.string().max(20),
  eta: z.string().max(80),
  logoRemoved: z.boolean(),
  coverRemoved: z.boolean(),
})
