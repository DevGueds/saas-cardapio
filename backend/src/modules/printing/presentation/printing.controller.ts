import { Body, Controller, Get, Inject, Param, Put, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"

@Controller("restaurants/:restaurantId")
export class PrintingController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Get("printing/settings") settings(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
  ) {
    return this.app.printing.settings(authenticated(req).actor, store)
  }
  @Put("printing/settings") update(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Body() input: unknown,
  ) {
    return this.app.printing.update(authenticated(req).actor, store, input)
  }
  @Get("orders/:orderId/documents/:kind") order(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Param("orderId") id: string,
    @Param("kind") kind: string,
  ) {
    return this.app.printing.order(authenticated(req).actor, store, id, kind)
  }
  @Get("payments/:paymentId/document") payment(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Param("paymentId") id: string,
  ) {
    return this.app.printing.payment(authenticated(req).actor, store, id)
  }
}
