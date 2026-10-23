import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common"
import type { FastifyReply } from "fastify"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { authenticated, MfaAllowed, type SessionRequest } from "./session-guard.js"
@Controller()
export class MfaController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @MfaAllowed() @Get("auth/mfa") status(@Req() req: SessionRequest) {
    return this.app.mfa.status(authenticated(req).actor)
  }
  @MfaAllowed() @Post("auth/mfa/setup") setup(
    @Req() req: SessionRequest,
    @Body() input: unknown,
  ) {
    return this.app.mfa.setup(authenticated(req).actor, input)
  }
  @MfaAllowed() @Post("auth/mfa/verify") async verify(
    @Req() req: SessionRequest,
    @Body() input: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.app.mfa.verify(authenticated(req).actor, input)
    if (!result.ok) return result
    reply.setCookie(this.app.config.cookieName, result.value.token, {
      httpOnly: true,
      secure: this.app.config.secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: this.app.config.sessionTtl,
    })
    return {
      ok: true,
      value: { session: result.value.session, recoveryCodes: result.value.recoveryCodes },
    }
  }
  @Delete("auth/mfa") async disable(
    @Req() req: SessionRequest,
    @Body() input: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.app.mfa.disable(authenticated(req).actor, input)
    if (result.ok)
      reply.clearCookie(this.app.config.cookieName, {
        path: "/",
        httpOnly: true,
        secure: this.app.config.secureCookies,
        sameSite: "lax",
      })
    return result
  }
  @Get("tenants/:tenantId/security") policy(
    @Req() req: SessionRequest,
    @Param("tenantId") id: string,
  ) {
    return this.app.mfa.policy(authenticated(req).actor, id)
  }
  @Put("tenants/:tenantId/security") changePolicy(
    @Req() req: SessionRequest,
    @Param("tenantId") id: string,
    @Body() input: unknown,
  ) {
    return this.app.mfa.changePolicy(authenticated(req).actor, id, input)
  }
  @Put("tenants/:tenantId/security/:userId") changeMember(
    @Req() req: SessionRequest,
    @Param("tenantId") id: string,
    @Param("userId") userId: string,
    @Body() input: unknown,
  ) {
    return this.app.mfa.changeMember(authenticated(req).actor, id, userId, input)
  }
}
