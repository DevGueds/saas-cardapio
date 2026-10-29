import { Controller, Get, Inject, Param, Query, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public } from "../../../shared/presentation/http.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
@Controller()
export class AnalyticsController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Get("restaurants/:restaurantId/analytics") report(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Query() query: unknown,
  ) {
    return this.app.analytics.report(authenticated(request).actor, id, query)
  }
  @Public() @Get("public/restaurants/:slug/best-sellers") bestSellers(
    @Req() request: SessionRequest,
    @Param("slug") slug: string,
  ) {
    return this.app.analytics.bestSellers(slug, request.ip)
  }
}
