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
import { Public } from "../../../shared/presentation/http.js"
import {
  authenticated,
  MfaAllowed,
  EmailAllowed,
  type SessionRequest,
} from "./session-guard.js"
@Controller()
export class IdentityController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  private async establish(
    result: ReturnType<Runtime["auth"]["login"]>,
    reply: FastifyReply,
  ) {
    const resolved = await result
    if (!resolved.ok) return resolved
    reply.setCookie(this.app.config.cookieName, resolved.value.token, {
      httpOnly: true,
      secure: this.app.config.secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: this.app.config.sessionTtl,
    })
    return { ok: true, value: resolved.value.session }
  }
  @Get("me/profile") profile(@Req() request: SessionRequest) {
    return this.app.profile.read(authenticated(request).actor)
  }
  @Put("me/profile") updateProfile(
    @Req() request: SessionRequest,
    @Body() input: unknown,
  ) {
    return this.app.profile.update(authenticated(request).actor, input)
  }
  @Public() @Post("auth/register-account") registerAccount(
    @Body() input: unknown,
    @Req() req: SessionRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.establish(this.app.auth.register(input, req.ip, true), reply)
  }
  @Public()
  @Post("auth/register")
  register(
    @Body() input: unknown,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.establish(this.app.auth.register(input, request.ip), reply)
  }
  @Public()
  @Post("auth/login")
  login(
    @Body() input: unknown,
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.establish(this.app.auth.login(input, request.ip), reply)
  }
  @EmailAllowed() @MfaAllowed() @Get("auth/session") session(
    @Req() request: SessionRequest,
  ) {
    return { ok: true, value: authenticated(request).view }
  }
  @EmailAllowed() @MfaAllowed() @Post("auth/logout") async logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.app.auth.logout(authenticated(request).actor)
    if (result.ok)
      reply.clearCookie(this.app.config.cookieName, {
        path: "/",
        httpOnly: true,
        secure: this.app.config.secureCookies,
        sameSite: "lax",
      })
    return result
  }
  @Put("auth/password") async password(
    @Req() request: SessionRequest,
    @Body() input: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.app.auth.changePassword(authenticated(request).actor, input)
    if (result.ok)
      reply.clearCookie(this.app.config.cookieName, {
        path: "/",
        httpOnly: true,
        secure: this.app.config.secureCookies,
        sameSite: "lax",
      })
    return result
  }
  @Get("me/restaurants") restaurants(@Req() request: SessionRequest) {
    return this.app.tenancy.restaurants(authenticated(request).actor)
  }
  @EmailAllowed() @Get("auth/email") emailStatus(@Req() request: SessionRequest) {
    return this.app.emailVerification.status(authenticated(request).actor)
  }
  @EmailAllowed() @Post("auth/email/send") emailSend(@Req() request: SessionRequest) {
    return this.app.emailVerification.send(authenticated(request).actor)
  }
  @EmailAllowed() @Post("auth/email/confirm") emailConfirm(
    @Req() request: SessionRequest,
    @Body() input: unknown,
  ) {
    return this.app.emailVerification.confirm(authenticated(request).actor, input)
  }
  @Post("tenants") tenant(@Req() request: SessionRequest, @Body() input: unknown) {
    return this.app.tenancy.create(authenticated(request).actor, input)
  }
  @Post("tenants/:tenantId/restaurants") restaurant(
    @Req() request: SessionRequest,
    @Param("tenantId") tenant: string,
    @Body() input: unknown,
  ) {
    return this.app.tenancy.createRestaurant(authenticated(request).actor, tenant, input)
  }
  @Get("tenants/:tenantId/members") members(
    @Req() request: SessionRequest,
    @Param("tenantId") tenant: string,
  ) {
    return this.app.tenancy.members(authenticated(request).actor, tenant)
  }
  @Post("tenants/:tenantId/members") addMember(
    @Req() request: SessionRequest,
    @Param("tenantId") tenant: string,
    @Body() input: unknown,
  ) {
    return this.app.tenancy.addMember(authenticated(request).actor, tenant, input)
  }
  @Delete("tenants/:tenantId/members/:userId") removeMember(
    @Req() request: SessionRequest,
    @Param("tenantId") tenant: string,
    @Param("userId") user: string,
  ) {
    return this.app.tenancy.removeMember(authenticated(request).actor, tenant, user)
  }
}
