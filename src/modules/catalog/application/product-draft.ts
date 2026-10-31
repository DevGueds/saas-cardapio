import { z } from "zod"
export const productDraftSchema = z.strictObject({
  revision: z.number().int().min(0),
  name: z.string().max(120),
  description: z.string().max(2000),
  price: z.string().max(20),
  categoryId: z.string().max(100),
  newCategory: z.boolean(),
  categoryName: z.string().max(80),
  available: z.boolean(),
  popular: z.boolean(),
  imageRemoved: z.boolean(),
  addonGroupIds: z.array(z.string().max(100)).max(100).optional(),
})
