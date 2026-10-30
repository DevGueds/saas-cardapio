import { Controller, Get, Inject } from "@nestjs/common"
import { Failure } from "@cardapio/domain/failure"
import { RUNTIME, type Runtime } from "./composition.js"
import { Public } from "../shared/presentation/http.js"
import { openApi } from "./openapi.js"
@Controller()
export class SystemController {
  constructor(@Inject(RUNTIME) private readonly app: Runtime) {}
  @Public() @Get("health/live") live() {
    return { ok: true, value: { status: "up" } }
  }
  @Public() @Get("health/ready") ready() {
    return this.app.operation.run("health.ready", async () => {
      await this.app.redis.ping()
      await this.app.db.run((client) => client.$queryRaw`SELECT 1`)
      return { status: "ready" }
    })
  }
  @Public() @Get("configuration") configuration() {
    return {
      ok: true,
      value: {
        signupEnabled: this.app.config.signupEnabled,
        emailSendEnabled: this.app.config.emailSendEnabled,
        mapTileUrl: this.app.config.mapTileUrl,
        turnstileSiteKey: this.app.config.turnstileSiteKey || undefined,
        emailVerificationGraceSeconds: this.app.config.emailGraceSeconds,
      },
    }
  }
  @Public() @Get("openapi.json") docs() {
    if (!this.app.config.docsEnabled)
      throw new Failure("NOT_FOUND", "Rota não encontrada.")
    return openApi
  }
}
