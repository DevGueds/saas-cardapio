import { z } from "zod"
export const addonDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  id: z.string().uuid(),
  name: z.string().max(80),
  active: z.boolean(),
  min: z.string().max(3),
  max: z.string().max(3),
  productIds: z.array(z.string().uuid()).max(500),
  options: z
    .array(
      z.strictObject({
        id: z.string().uuid(),
        name: z.string().max(80),
        price: z.string().max(20),
        available: z.boolean(),
        maxQuantity: z.string().max(3),
      }),
    )
    .max(30),
})
