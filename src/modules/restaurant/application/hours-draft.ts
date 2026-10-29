import { z } from "zod"
const interval = z.object({ opensAt: z.string().max(5), closesAt: z.string().max(5) })
export const hoursDraftSchema = z.object({
  revision: z.number().int().nonnegative(),
  schedule: z.object({
    enabled: z.boolean(),
    timeZone: z.string().max(100),
    weekly: z.array(z.array(interval).max(4)).length(7),
    exceptions: z
      .array(
        z.object({
          date: z.string().max(10),
          label: z.string().max(100),
          yearly: z.boolean(),
          intervals: z.array(interval).max(4),
        }),
      )
      .max(200),
  }),
})
