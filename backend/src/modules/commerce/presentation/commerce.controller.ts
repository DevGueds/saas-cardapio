import { Body, Controller, Delete, Inject, Param, Put, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
@Controller("restaurants/:restaurantId")
export class CommerceController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Put("combos") combo(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.commerce.combo(authenticated(req).actor, id, data)
  }
  @Put("promotions") promotion(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.commerce.promotion(authenticated(req).actor, id, data)
  }
  @Put("delivery") delivery(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.commerce.delivery(authenticated(req).actor, id, data)
  }
  @Delete("combos/:offerId") removeCombo(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("offerId") offer: string,
    @Body() data: unknown,
  ) {
    return this.app.commerce.remove(authenticated(req).actor, id, "combos", offer, data)
  }
  @Delete("promotions/:offerId") removePromotion(
    @Req() req: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("offerId") offer: string,
    @Body() data: unknown,
  ) {
    return this.app.commerce.remove(
      authenticated(req).actor,
      id,
      "promotions",
      offer,
      data,
    )
  }
}
