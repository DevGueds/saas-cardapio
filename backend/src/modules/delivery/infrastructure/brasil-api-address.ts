import { z } from "zod"
import { postalAddressSchema, type PostalAddress } from "@cardapio/contracts"
import { Failure, requireValid } from "@cardapio/domain/failure"
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
const viaCepSchema = z.object({
  cep: z.string(),
  uf: z.string(),
  localidade: z.string(),
  bairro: z.string().default(""),
  logradouro: z.string().default(""),
})
type Http = Pick<ResilientHttp, "getJson">
export class BrasilApiAddress implements AddressLookup {
  constructor(
    private readonly http: Http,
    private readonly cache: CacheStore,
    private readonly limiter: RequestLimiter,
    private readonly fallback: Http,
  ) {}
  async lookup(cep: string) {
    requireValid(/^\d{8}$/.test(cep), "Informe os 8 números do CEP.", "cep")
    const key = "cep:" + cep,
      cached = await this.cache.get(key)
    if (cached !== null) {
      try {
        const address = postalAddressSchema.parse(JSON.parse(cached))
        if (address.cep === cep) return address
      } catch {
        // An invalid cache entry is replaced only after a verified provider response.
      }
    }
    let address: PostalAddress
    try {
      address = await this.primary(cep)
    } catch (primaryError) {
      if (primaryError instanceof Failure && primaryError.code === "RATE_LIMITED")
        throw primaryError
      try {
        address = await this.secondary(cep)
      } catch (fallbackError) {
        if (fallbackError instanceof Failure && fallbackError.code === "RATE_LIMITED")
          throw fallbackError
        const missing = [primaryError, fallbackError].every(
          (error) => error instanceof Failure && error.code === "NOT_FOUND",
        )
        throw new Failure(
          missing ? "NOT_FOUND" : "CAPABILITY_UNAVAILABLE",
          missing
            ? "CEP não encontrado. Confira os números ou preencha o endereço manualmente."
            : "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.",
        )
      }
    }
    await this.cache.set(key, JSON.stringify(address), 86400)
    return address
  }
  private async primary(cep: string): Promise<PostalAddress> {
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
      value?.trim() && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit
        ? Number(value)
        : null
    return postalAddressSchema.parse({
      cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      street: data.street,
      latitude: coordinate(c?.latitude, 90),
      longitude: coordinate(c?.longitude, 180),
    })
  }
  private async secondary(cep: string): Promise<PostalAddress> {
    await this.limiter.consume("provider:viacep", 60, 60)
    const response = await this.fallback.getJson(`https://viacep.com.br/ws/${cep}/json/`)
    if (
      response &&
      typeof response === "object" &&
      "erro" in response &&
      (response.erro === true || response.erro === "true")
    )
      throw new Failure("NOT_FOUND", "CEP não encontrado.")
    const data = viaCepSchema.parse(response)
    requireValid(
      data.cep.replace(/\D/g, "") === cep,
      "CEP retornado não corresponde à consulta.",
      "cep",
    )
    return postalAddressSchema.parse({
      cep,
      state: data.uf,
      city: data.localidade,
      neighborhood: data.bairro,
      street: data.logradouro,
      latitude: null,
      longitude: null,
    })
  }
}
