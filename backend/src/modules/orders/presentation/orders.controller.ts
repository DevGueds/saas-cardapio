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
  @Public() @Get("public/restaurants/:slug/checkout/attempt") receipt(
    @Param("slug") slug: string,
    @Headers("idempotency-key") key: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.app.orders.receipt(slug, key, req.ip)
  }
  @Public() @Post("public/restaurants/:slug/checkout/quote") quote(
    @Param("slug") slug: string,
    @Body() data: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.app.orders.quote(slug, data, req.ip)
  }
  @Public() @Get("public/restaurants/:slug/orders/:orderId") track(
    @Param("slug") slug: string,
    @Param("orderId") id: string,
    @Headers("x-order-token") token: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.app.orders.track(slug, id, token, req.ip)
  }
  @Get("restaurants/:restaurantId/couriers") couriers(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
  ) {
    return this.app.orders.couriers(authenticated(req).actor, id)
  }
  @Put("restaurants/:restaurantId/orders/:orderId/courier") assign(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("orderId") order: string,
    @Body() data: unknown,
  ) {
    return this.app.orders.assign(authenticated(req).actor, id, order, data)
  }
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
