import { z } from "zod"
import { uuid, cents } from "./common.js"

export const geoPointSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
export const radiusBandSchema = z.strictObject({
  id: uuid,
  maxMeters: z.number().int().min(1).max(100000),
  fee: cents,
})
export const radiusDeliverySchema = z.strictObject({
  origin: geoPointSchema.nullable(),
  bands: z.array(radiusBandSchema).max(20),
})
export const radiusSnapshotSchema = z.strictObject({
  origin: geoPointSchema,
  distanceMeters: z.number().int().min(0).max(100000),
  maxMeters: z.number().int().min(1).max(100000),
  fee: cents,
})
