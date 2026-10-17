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
} from "@nestjs/common"
import { RUNTIME, type Runtime } from "../../../app/composition.js"
import { Public } from "../../../shared/presentation/http.js"
import {
  authenticated,
  type SessionRequest,
} from "../../identity/presentation/session-guard.js"
@Controller()
export class CatalogController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Public() 
 @Get("public/restaurants/:slug/menu") 
async publicMenu(@Param("slug") slug: string) {
  try {
    return await this.app.catalog.publicMenu(slug)
  } catch (err) {
    console.error("🔥 ERRO DETALHADO DO PUBLIC MENU:", err)
    throw err
  }
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
}
