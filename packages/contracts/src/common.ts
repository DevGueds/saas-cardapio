import { z } from "zod"
export const uuid = z.uuid()
export const revision = z.number().int().min(0).max(2_147_483_646)
export const cents = z.number().int().min(0).max(2_147_483_647)
