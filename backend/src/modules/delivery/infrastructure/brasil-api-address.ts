import { z } from "zod"
import { postalAddressSchema } from "@cardapio/contracts"
import { Failure } from "@cardapio/domain/failure"
import type { AddressLookup } from "../application/postal-address.js"
import type { CacheStore } from "../../../shared/application/cache.js"
import type { RequestLimiter } from "../../../shared/application/ports.js"
import type { ResilientHttp } from "../../../shared/infrastructure/resilient-http.js"
const responseSchema = z.object({
  cep: z.string(),
  state: z.string(),
  city: z.string(),
  neighborhood: z.string().default(""),
  street: z.string().default(""),
  location: z
    .object({
      coordinates: z
        .object({ latitude: z.string().optional(), longitude: z.string().optional() })
        .optional(),
    })
    .optional(),
})
export class BrasilApiAddress implements AddressLookup {
  constructor(
    private readonly http: ResilientHttp,
    private readonly cache: CacheStore,
    private readonly limiter: RequestLimiter,
  ) {}
  async lookup(cep: string) {
    const key = "cep:" + cep,
      cached = await this.cache.get(key)
    if (cached !== null) {
      try {
        return postalAddressSchema.parse(JSON.parse(cached))
      } catch {
        throw new Failure(
          "CORRUPT_DATA",
          "Endereço temporário inválido. Preencha manualmente.",
        )
      }
    }
    await this.limiter.consume("provider:brasil-api", 60, 60)
    const parsed = responseSchema.safeParse(
      await this.http.getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`),
    )
    if (!parsed.success || parsed.data.cep.replace(/\D/g, "") !== cep)
      throw new Failure(
        "CORRUPT_DATA",
        "Não foi possível validar o endereço. Preencha manualmente.",
      )
    const data = parsed.data,
      c = data.location?.coordinates
    const coordinate = (value: string | undefined, limit: number) =>
      value && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit
        ? Number(value)
        : null
    const address = postalAddressSchema.parse({
      cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      street: data.street,
      latitude: coordinate(c?.latitude, 90),
      longitude: coordinate(c?.longitude, 180),
    })
    await this.cache.set(key, JSON.stringify(address), 86400)
    return address
  }
}
