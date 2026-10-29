import {
  paymentInputSchema,
  reportRangeSchema,
  reversalSchema,
  uuid,
} from "@cardapio/contracts"
import { parseMoney } from "@cardapio/domain/money"
import type { Actor } from "../../identity/domain/identity.js"
import type { AccessPolicy } from "../../identity/application/ports.js"
import type {
  Clock,
  IdGenerator,
  SecretTokens,
} from "../../../shared/application/ports.js"
import type { Operation } from "../../../shared/application/operation.js"
import { validate } from "../../../shared/application/validate.js"
import type { FinancialReportCalculator, PaymentsRepository } from "./ports.js"
import { buildReport } from "./report.js"

export class Payments {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly access: AccessPolicy,
    private readonly operation: Operation,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly secrets: SecretTokens,
    private readonly reports: FinancialReportCalculator = {
      calculate: async (...args) => buildReport(...args),
    },
  ) {}

  record(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("payments.record", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "payments:write")
      const { requestId, ...data } = validate(paymentInputSchema, input)
      const normalized = { ...data, amount: parseMoney(data.amount, "amount", true) }
      return this.repository.record(scope, {
        ...normalized,
        id: this.ids.next(),
        recordedBy: actor.userId,
        now: this.clock.now(),
        requestHash: this.secrets.hash(requestId),
        payloadHash: this.secrets.fingerprint(JSON.stringify(normalized)),
      })
    })
  }
  reverse(actor: Actor, restaurantId: string, id: string, input: unknown) {
    return this.operation.run("payments.reverse", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "payments:reverse")
      const { reason } = validate(reversalSchema, input)
      return this.repository.reverse(
        scope,
        validate(uuid, id),
        actor.userId,
        reason,
        this.clock.now(),
      )
    })
  }
  balance(actor: Actor, restaurantId: string, id: string) {
    return this.operation.run("payments.balance", async () =>
      this.repository.balance(
        await this.access.restaurant(actor, restaurantId, "payments:read"),
        validate(uuid, id),
      ),
    )
  }
  list(actor: Actor, restaurantId: string, input: unknown, cursor?: string) {
    return this.operation.run("payments.list", async () =>
      this.repository.list(
        await this.access.restaurant(actor, restaurantId, "payments:read"),
        validate(reportRangeSchema, input),
        cursor === undefined ? undefined : validate(uuid, cursor),
      ),
    )
  }
  report(actor: Actor, restaurantId: string, input: unknown) {
    return this.operation.run("reports.financial", async () => {
      const scope = await this.access.restaurant(actor, restaurantId, "reports:read")
      const range = validate(reportRangeSchema, input)
      const snapshot = await this.repository.report(scope, range)
      return this.reports.calculate(
        range,
        snapshot.orders,
        snapshot.payments,
        this.clock.now().toISOString(),
      )
    })
  }
}
