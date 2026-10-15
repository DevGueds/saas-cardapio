import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public } from "../../../shared/presentation/http.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
@Controller()
export class OrdersController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Public() @Post("public/restaurants/:slug/checkout/prepare") prepare(
    @Param("slug") slug: string,
    @Body() data: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.app.orders.prepare(slug, data, request.ip)
  }
  @Public() @Post("public/restaurants/:slug/orders") create(
    @Param("slug") slug: string,
    @Headers("idempotency-key") key: unknown,
    @Body() data: unknown,
    @Req() request: SessionRequest,
  ) {
    return this.app.orders.create(slug, key, data, request.ip)
  }
  @Get("restaurants/:restaurantId/orders") list(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.app.orders.list(authenticated(request).actor, id, cursor)
  }
  @Put("restaurants/:restaurantId/orders/:orderId/status") transition(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("orderId") order: string,
    @Body() data: unknown,
  ) {
    return this.app.orders.transition(authenticated(request).actor, id, order, data)
  }
}
