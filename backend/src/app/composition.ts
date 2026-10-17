import { Catalog } from "../modules/catalog/application/catalog.js"
import { PrismaMenu } from "../modules/catalog/infrastructure/prisma-menu.js"
import { Authentication } from "../modules/identity/application/authentication.js"
import { Authorization } from "../modules/identity/application/authorization.js"
import { Tenancy } from "../modules/identity/application/tenancy.js"
import { PrismaAccess } from "../modules/identity/infrastructure/prisma-access.js"
import { PrismaIdentity } from "../modules/identity/infrastructure/prisma-identity.js"
import { Orders } from "../modules/orders/application/orders.js"
import { PrismaOrders } from "../modules/orders/infrastructure/prisma-orders.js"
import { Operation } from "../shared/application/operation.js"
import { Database } from "../shared/infrastructure/database.js"
import { PrismaLimiter } from "../shared/infrastructure/prisma-limiter.js"
import {
  ArgonPasswords,
  NodeSecrets,
  clock,
  diagnostics,
  ids,
} from "../shared/infrastructure/runtime.js"
import type { ApiConfig } from "./config.js"

export const RUNTIME = Symbol("application-runtime")
export type Runtime = Awaited<ReturnType<typeof compose>>

export async function compose(config: ApiConfig) {
  const db = new Database(config)
  const operation = new Operation(diagnostics, ids, clock)

  try {
    const secrets = new NodeSecrets(config.secret)
    const limiter = new PrismaLimiter(db, secrets, clock)
    const identity = new PrismaIdentity(db)
    const memberships = new PrismaAccess(db)
    const access = new Authorization(identity, memberships, clock)
    const menus = new PrismaMenu(db)

    return {
      config,
      db,
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
      catalog: new Catalog(menus, access, ids, operation),
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
    await db.close()
    throw error
  }
}