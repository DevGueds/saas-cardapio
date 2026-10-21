import { PostalAddresses } from "../modules/delivery/application/postal-address.js"
import { Engagement } from "../modules/engagement/application/engagement.js"
import { PrismaEngagement } from "../modules/engagement/infrastructure/prisma-engagement.js"
import { SubscriptionCipher } from "../modules/engagement/infrastructure/subscription-cipher.js"
import { EvolutionWhatsapp } from "../modules/engagement/infrastructure/evolution-whatsapp.js"
import { WebPushSender } from "../modules/engagement/infrastructure/web-push.js"
import { NotificationWorker } from "../modules/engagement/infrastructure/notification-worker.js"
import { Payments } from "../modules/payments/application/payments.js"
import { createDiagnostics } from "../shared/infrastructure/logging.js"
import { PrismaPayments } from "../modules/payments/infrastructure/prisma-payments.js"
import { BrasilApiAddress } from "../modules/delivery/infrastructure/brasil-api-address.js"
import { ResilientHttp } from "../shared/infrastructure/resilient-http.js"
import { CommerceManagement } from "../modules/commerce/application/commerce.js"
import type { ApiConfig } from "./config.js"
import { Operation } from "../shared/application/operation.js"
import { Database } from "../shared/infrastructure/database.js"
import {
  ArgonPasswords,
  NodeSecrets,
  clock,
  ids,
} from "../shared/infrastructure/runtime.js"
import { RedisStore, RedisLimiter } from "../shared/infrastructure/redis.js"
import { CachedMenu } from "../modules/catalog/infrastructure/cached-menu.js"
import { Authentication } from "../modules/identity/application/authentication.js"
import { Authorization } from "../modules/identity/application/authorization.js"
import { Tenancy } from "../modules/identity/application/tenancy.js"
import { PrismaIdentity } from "../modules/identity/infrastructure/prisma-identity.js"
import { PrismaAccess } from "../modules/identity/infrastructure/prisma-access.js"
import { Catalog } from "../modules/catalog/application/catalog.js"
import { PrismaMenu } from "../modules/catalog/infrastructure/prisma-menu.js"
import { Orders } from "../modules/orders/application/orders.js"
import { PrismaOrders } from "../modules/orders/infrastructure/prisma-orders.js"

export const RUNTIME = Symbol("application-runtime")
export type Runtime = Awaited<ReturnType<typeof compose>>
export async function compose(config: ApiConfig) {
  const db = new Database(config)
  const redis = new RedisStore(
    config.redisUrl,
    config.environment + ":" + config.database.pathname.slice(1),
  )
  const diagnostics = createDiagnostics({
    level: config.logLevel,
    directory: config.logDirectory,
    instance: config.logInstance,
  })
  const operation = new Operation(diagnostics, ids, clock)
  try {
    await db.connect()
    await redis.connect()
    const secrets = new NodeSecrets(config.secret)
    const limiter = new RedisLimiter(redis, secrets)
    const identity = new PrismaIdentity(db),
      memberships = new PrismaAccess(db)
    const access = new Authorization(identity, memberships, clock)
    const menus = new CachedMenu(new PrismaMenu(db), redis)
    const cipher = new SubscriptionCipher(config.secret),
      whatsapp = new EvolutionWhatsapp(config.evolutionUrl, config.evolutionKey),
      push = new WebPushSender(
        config.vapidSubject,
        config.vapidPublicKey,
        config.vapidPrivateKey,
      )
    const notificationWorker = new NotificationWorker(
      db,
      cipher,
      whatsapp,
      push,
      operation,
    )
    return {
      notificationWorker,
      engagement: new Engagement(
        new PrismaEngagement(db, cipher),
        menus,
        access,
        operation,
        secrets,
        clock,
        ids,
        limiter,
        whatsapp,
        config.vapidPublicKey,
      ),
      config,
      diagnostics,
      payments: new Payments(
        new PrismaPayments(db),
        access,
        operation,
        ids,
        clock,
        secrets,
      ),
      db,
      redis,
      operation,
      secrets,
      limiter,
      auth: new Authentication(
        identity,
        await ArgonPasswords.create(),
        secrets,
        ids,
        clock,
        limiter,
        operation,
        { signupEnabled: config.signupEnabled, ttl: config.sessionTtl },
      ),
      tenancy: new Tenancy(memberships, access, ids, operation),
      addresses: new PostalAddresses(
        new BrasilApiAddress(
          new ResilientHttp({
            timeoutMs: 2000,
            concurrency: 4,
            failureThreshold: 3,
            cooldownMs: 30000,
          }),
          redis,
          limiter,
          new ResilientHttp({
            timeoutMs: 2000,
            concurrency: 4,
            failureThreshold: 3,
            cooldownMs: 30000,
          }),
        ),
        limiter,
        operation,
      ),
      commerce: new CommerceManagement(menus, access, operation),
      catalog: new Catalog(menus, access, ids, operation, menus),
      orders: new Orders(
        new PrismaOrders(db),
        menus,
        access,
        operation,
        ids,
        clock,
        secrets,
        limiter,
      ),
    }
  } catch (error) {
    redis.close()
    await db.close()
    await diagnostics.close()
    throw error
  }
}
