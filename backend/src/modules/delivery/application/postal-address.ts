import { requireValid } from "@cardapio/domain/failure"
import type { PostalAddress } from "@cardapio/contracts"
import type { Operation } from "../../../shared/application/operation.js"
import type { RequestLimiter } from "../../../shared/application/ports.js"
export interface AddressLookup {
  lookup(cep: string): Promise<PostalAddress>
}
export class PostalAddresses {
  constructor(
    private readonly provider: AddressLookup,
    private readonly limiter: RequestLimiter,
    private readonly operation: Operation,
  ) {}
  lookup(cep: string, ip: string) {
    return this.operation.run("delivery.lookup-cep", async () => {
      requireValid(/^\d{8}$/.test(cep), "Informe os 8 números do CEP.", "cep")
      await this.limiter.consume("cep:" + ip, 20, 60)
      return this.provider.lookup(cep)
    })
  }
}
