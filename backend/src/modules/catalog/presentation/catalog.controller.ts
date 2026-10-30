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
import { socialMetadata } from "../infrastructure/social-images.js"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public } from "../../../shared/presentation/http.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
@Controller()
export class CatalogController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Public() @Get("public/restaurants/:slug/share") async share(
    @Param("slug") slug: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.app.catalog.publicMenu(slug)
    if (!result.ok) {
      if (result.error.code === "NOT_FOUND")
        return reply
          .type("text/html; charset=utf-8")
          .send(
            '<meta name="robots" content="noindex"><title>Cardápio indisponível · Pede Aqui</title>',
          )
      return reply.status(503).send(result)
    }
    return reply
      .header("Cache-Control", "public, max-age=60")
      .type("text/html; charset=utf-8")
      .send(socialMetadata(result.value, this.app.config.origins[0]!))
  }
  @Public() @Get("public/restaurants/:slug/share-image/:format") async shareImage(
    @Param("slug") slug: string,
    @Param("format") format: string,
    @Res() reply: FastifyReply,
  ) {
    if (format !== "square.png" && format !== "landscape.png")
      return reply.status(404).send()
    const result = await this.app.catalog.publicMenu(slug)
    if (!result.ok)
      return reply.status(result.error.code === "NOT_FOUND" ? 404 : 503).send(result)
    const image = await this.app.socialImages.render(
      result.value,
      format === "square.png" ? "square" : "landscape",
    )
    return reply
      .header("Cache-Control", "public, max-age=60")
      .type("image/png")
      .send(image)
  }
  @Post("restaurants/:restaurantId/categories") createCategory(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.category(authenticated(request).actor, id, data)
  }
  @Put("restaurants/:restaurantId/categories/:categoryId") updateCategory(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("categoryId") category: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.category(authenticated(request).actor, id, data, category)
  }
  @Delete("restaurants/:restaurantId/categories/:categoryId") removeCategory(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("categoryId") category: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.deleteCategory(
      authenticated(request).actor,
      id,
      category,
      data,
    )
  }
  @Public() @Get("public/restaurants/:slug/menu") publicMenu(
    @Param("slug") slug: string,
  ) {
    return this.app.catalog.publicMenu(slug)
  }
  @Get("restaurants/:restaurantId/menu") menu(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
  ) {
    return this.app.catalog.adminMenu(authenticated(request).actor, id)
  }
  @Post("restaurants/:restaurantId/products") create(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.save(authenticated(request).actor, id, data)
  }
  @Put("restaurants/:restaurantId/products/:productId") update(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("productId") product: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.save(authenticated(request).actor, id, data, product)
  }
  @Put("restaurants/:restaurantId/products/:productId/availability") availability(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("productId") product: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.availability(authenticated(request).actor, id, product, data)
  }
  @Delete("restaurants/:restaurantId/products/:productId") remove(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Param("productId") product: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.delete(authenticated(request).actor, id, product, data)
  }
  @Put("restaurants/:restaurantId/settings") settings(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.settings(authenticated(request).actor, id, data)
  }
  @Put("restaurants/:restaurantId/open") open(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.open(authenticated(request).actor, id, data)
  }
  @Put("restaurants/:restaurantId/sharing") sharing(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() input: unknown,
  ) {
    return this.app.catalog.sharing(authenticated(request).actor, id, input)
  }
  @Put("restaurants/:restaurantId/hours") hours(
    @Req() request: SessionRequest,
    @Param("restaurantId") id: string,
    @Body() data: unknown,
  ) {
    return this.app.catalog.hours(authenticated(request).actor, id, data)
  }
}
