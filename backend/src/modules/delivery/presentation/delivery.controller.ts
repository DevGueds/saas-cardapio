import { Controller, Get, Inject, Param, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public } from "../../../shared/presentation/http.js"
import type { SessionRequest } from "../../identity/presentation/session-guard.js"
@Controller("public/addresses")
export class DeliveryController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Public() @Get(":cep") lookup(@Param("cep") cep: string, @Req() req: SessionRequest) {
    return this.app.addresses.lookup(cep, req.ip)
  }
}
