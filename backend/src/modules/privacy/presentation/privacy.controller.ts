import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"

@Controller("me/privacy")
export class PrivacyController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Get() profile(@Req() request: SessionRequest) {
    return this.app.privacy.profile(authenticated(request).actor)
  }
  @Post("export") export(@Req() request: SessionRequest, @Body() input: unknown) {
    return this.app.privacy.export(authenticated(request).actor, input)
  }
  @Post("acceptance") accept(@Req() request: SessionRequest, @Body() input: unknown) {
    return this.app.privacy.accept(authenticated(request).actor, input)
  }
  @Post("requests") create(@Req() request: SessionRequest, @Body() input: unknown) {
    return this.app.privacy.request(authenticated(request).actor, input)
  }
}
