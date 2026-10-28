import { DeliveryController } from "../modules/delivery/presentation/delivery.controller.js"
import { EngagementController } from "../modules/engagement/presentation/engagement.controller.js"
import { PaymentsController } from "../modules/payments/presentation/payments.controller.js"
import { PrintingController } from "../modules/printing/presentation/printing.controller.js"
import { Bulkhead } from "../shared/application/bulkhead.js"
import { CommerceController } from "../modules/commerce/presentation/commerce.controller.js"
import { SessionGuard } from "../modules/identity/presentation/session-guard.js"
import "reflect-metadata"
import { Module } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify"
import cookie from "@fastify/cookie"
import helmet from "@fastify/helmet"
import { Failure } from "@cardapio/domain/failure"
import { compose, RUNTIME } from "./composition.js"
import type { ApiConfig } from "./config.js"
import { IdentityController } from "../modules/identity/presentation/identity.controller.js"
import { MfaController } from "../modules/identity/presentation/mfa.controller.js"
import { CatalogController } from "../modules/catalog/presentation/catalog.controller.js"
import { OrdersController } from "../modules/orders/presentation/orders.controller.js"
import { SystemController } from "./system.controller.js"
import {
  errorStatus,
  HttpErrors,
  ResultInterceptor,
} from "../shared/presentation/http.js"

export async function createApplication(config: ApiConfig) {
  const runtime = await compose(config)
  @Module({
    controllers: [
      IdentityController,
      MfaController,
      CatalogController,
      OrdersController,
      CommerceController,
      DeliveryController,
      EngagementController,
      PaymentsController,
      PrintingController,
      SystemController,
    ],
    providers: [
      { provide: RUNTIME, useValue: runtime },
      {
        provide: "database-lifecycle",
        useValue: {
          onApplicationShutdown: async () => {
            await runtime.notificationWorker.close()
            runtime.redis.close()
            await runtime.db.close()
            await runtime.diagnostics.close()
          },
        },
      },
    ],
  })
  class ApplicationModule {}
  const adapter = new FastifyAdapter({
    logger: false,
    allowErrorHandlerOverride: false,
    trustProxy: config.trustedProxyHops
      ? (_addr: string, hop: number) => hop < config.trustedProxyHops
      : config.trustedProxies.length
        ? config.trustedProxies
        : false,
    bodyLimit: 15 * 1024 * 1024,
    requestTimeout: 15000,
    connectionTimeout: 10000,
    keepAliveTimeout: 5000,
    routerOptions: { maxParamLength: 120 },
  })
  const app = await NestFactory.create<NestFastifyApplication>(
    ApplicationModule,
    adapter,
    { logger: false, abortOnError: false },
  )
  try {
    await app.register(cookie)
    await app.register(helmet, { crossOriginResourcePolicy: { policy: "same-site" } })
    app.enableCors({
      origin: config.origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "X-CSRF-Token",
        "Idempotency-Key",
        "X-Order-Token",
        "X-Board-Key",
        "Last-Event-ID",
      ],
      maxAge: 600,
    })
    adapter.getInstance().addHook("onRoute", (route) => {
      const acceptsImages =
        /^\/api\/v1\/restaurants\/[^/]+\/(settings|combos|products(?:\/[^/]+)?)$/.test(
          route.url,
        )
      route.bodyLimit = acceptsImages
        ? 15 * 1024 * 1024
        : route.url.endsWith("/printing/settings")
          ? 512 * 1024
          : route.url.endsWith("/delivery")
            ? 256 * 1024
            : 32 * 1024
    })
    const capacity = new Bulkhead(config.maxInFlight)
    const releases = new WeakMap<object, () => void>()
    adapter.getInstance().addHook("onResponse", async (request, reply) => {
      releases.get(request)?.()
      releases.delete(request)
      if (!request.url.startsWith("/api/v1/health/"))
        runtime.diagnostics.http({
          requestId: request.id,
          method: request.method,
          route: request.routeOptions.url ?? "unmatched",
          status: reply.statusCode,
          durationMs: Math.round(reply.elapsedTime),
        })
    })
    adapter.getInstance().addHook("onRequestAbort", async (request) => {
      releases.get(request)?.()
      releases.delete(request)
    })
    adapter.getInstance().addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "no-store")
      try {
        if (
          !request.url.startsWith("/api/v1/health/") &&
          !request.routeOptions.url?.endsWith("/board/stream")
        )
          releases.set(request, capacity.enter())
        const origin = request.headers.origin
        const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method)
        if (
          (origin !== undefined && !config.origins.includes(origin)) ||
          (unsafe && !origin)
        )
          throw new Failure(
            "ACCESS_DENIED",
            "Este endereço não está autorizado a acessar a loja. Peça ao responsável para conferir a configuração de acesso.",
            {},
            origin ? "origin_not_allowed" : "origin_missing",
          )
        if (
          unsafe &&
          !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")
        )
          throw new Failure("VALIDATION", "Envie os dados no formato JSON.")
        if (request.method !== "OPTIONS" && !request.url.startsWith("/api/v1/health/"))
          await runtime.limiter.consume("http:" + request.ip, config.httpRateLimit, 60)
      } catch (cause) {
        const error = runtime.operation.error("http.boundary", cause)
        if (
          ["RATE_LIMITED", "CAPABILITY_UNAVAILABLE", "STORAGE_UNAVAILABLE"].includes(
            error.code,
          )
        )
          reply.header("Retry-After", "5")
        await reply.status(errorStatus(error)).send({ ok: false, error })
      }
    })
    app.setGlobalPrefix("api/v1")
    app.useGlobalGuards(
      new SessionGuard(runtime.auth, runtime.secrets, config.cookieName),
    )
    app.useGlobalInterceptors(new ResultInterceptor())
    app.useGlobalFilters(new HttpErrors(runtime.operation))
    app.enableShutdownHooks()
    await app.init()
    await adapter.getInstance().ready()
    if (config.environment !== "test") runtime.notificationWorker.start()
    return {
      app,
      runtime,
      close: async () => {
        await app.close()
        runtime.redis.close()
        await runtime.db.close()
      },
    }
  } catch (cause) {
    await app.close()
    runtime.redis.close()
    await runtime.db.close()
    throw cause
  }
}
