import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"

@Controller("restaurants/:restaurantId")
export class PaymentsController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Post("payments") record(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Body() input: unknown,
  ) {
    return this.app.payments.record(authenticated(req).actor, store, input)
  }
  @Post("payments/:paymentId/reverse") reverse(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Param("paymentId") id: string,
    @Body() input: unknown,
  ) {
    return this.app.payments.reverse(authenticated(req).actor, store, id, input)
  }
  @Get("orders/:orderId/balance") balance(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Param("orderId") id: string,
  ) {
    return this.app.payments.balance(authenticated(req).actor, store, id)
  }
  @Get("payments") list(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.app.payments.list(authenticated(req).actor, store, { from, to }, cursor)
  }
  @Get("reports/financial") report(
    @Req() req: SessionRequest,
    @Param("restaurantId") store: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.app.payments.report(authenticated(req).actor, store, { from, to })
  }
}
