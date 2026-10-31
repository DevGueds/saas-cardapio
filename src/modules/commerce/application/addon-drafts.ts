import { z } from "zod"
const draftId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)
export const addonDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  id: draftId,
  name: z.string().max(80),
  active: z.boolean(),
  min: z.string().max(3),
  max: z.string().max(3),
  productIds: z.array(draftId).max(500),
  options: z
    .array(
      z.strictObject({
        id: draftId,
        name: z.string().max(80),
        price: z.string().max(20),
        available: z.boolean(),
        maxQuantity: z.string().max(3),
      }),
    )
    .max(30),
})
