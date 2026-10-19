import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common"
import type { FastifyReply } from "fastify"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public, errorStatus } from "../../../shared/presentation/http.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
import { BoardStreams } from "./board-streams.js"
@Controller()
export class EngagementController {
  private readonly streams: BoardStreams
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {
    this.streams = new BoardStreams(app.engagement)
  }
  onApplicationShutdown() {
    this.streams.close()
  }
  @Get("restaurants/:id/channels") settings(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.settings(authenticated(req).actor, id)
  }
  @Put("restaurants/:id/channels") update(
    @Req() req: SessionRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.app.engagement.update(authenticated(req).actor, id, body)
  }
  @Public() @Get("public/restaurants/:slug/board/stream") async board(
    @Param("slug") slug: string,
    @Headers("x-board-key") key: unknown,
    @Res() reply: FastifyReply,
  ) {
    const initial = await this.app.engagement.board(slug, key)
    if (!initial.ok) return reply.status(errorStatus(initial.error)).send(initial)
    this.streams.open(slug, key as string, reply, initial.value)
  }
  @Public() @Get("public/push/configuration") pushConfig() {
    return { ok: true, value: this.app.engagement.configuration() }
  }
  @Get("restaurants/:id/notifications") inbox(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.inbox(authenticated(req).actor, id)
  }
  @Post("restaurants/:id/notifications/read") read(
    @Req() req: SessionRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.app.engagement.read(authenticated(req).actor, id, body)
  }
  @Post("restaurants/:id/push") push(
    @Req() req: SessionRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.app.engagement.staffPush(authenticated(req).actor, id, body)
  }
  @Delete("restaurants/:id/push") unpush(
    @Req() req: SessionRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.app.engagement.staffPush(authenticated(req).actor, id, body, true)
  }
  @Get("restaurants/:id/whatsapp") whatsapp(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.whatsappState(authenticated(req).actor, id, "state")
  }
  @Post("restaurants/:id/whatsapp/connect") connect(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.whatsappState(authenticated(req).actor, id, "connect")
  }
  @Delete("restaurants/:id/whatsapp") disconnect(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.whatsappState(authenticated(req).actor, id, "disconnect")
  }
  @Get("restaurants/:id/notification-deliveries") deliveries(
    @Req() req: SessionRequest,
    @Param("id") id: string,
  ) {
    return this.app.engagement.deliveries(authenticated(req).actor, id)
  }
  @Public() @Get("public/restaurants/:slug/orders/:orderId/notifications") preferences(
    @Req() req: SessionRequest,
    @Param("slug") slug: string,
    @Param("orderId") id: string,
    @Headers("x-order-token") token: unknown,
  ) {
    return this.app.engagement.customerPreferences(slug, id, token, req.ip)
  }
  @Public() @Put("public/restaurants/:slug/orders/:orderId/notifications") consent(
    @Req() req: SessionRequest,
    @Param("slug") slug: string,
    @Param("orderId") id: string,
    @Headers("x-order-token") token: unknown,
    @Body() body: unknown,
  ) {
    return this.app.engagement.consent(slug, id, token, req.ip, body)
  }
  @Public() @Post("public/restaurants/:slug/orders/:orderId/push") customerPush(
    @Req() req: SessionRequest,
    @Param("slug") slug: string,
    @Param("orderId") id: string,
    @Headers("x-order-token") token: unknown,
    @Body() body: unknown,
  ) {
    return this.app.engagement.customerPush(slug, id, token, req.ip, body)
  }
  @Public() @Delete("public/restaurants/:slug/orders/:orderId/push") customerUnpush(
    @Req() req: SessionRequest,
    @Param("slug") slug: string,
    @Param("orderId") id: string,
    @Headers("x-order-token") token: unknown,
    @Body() body: unknown,
  ) {
    return this.app.engagement.customerPush(slug, id, token, req.ip, body, true)
  }
}
