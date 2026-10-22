import { randomUUID } from "node:crypto"
import { Failure } from "@cardapio/domain/failure"
import type { Database } from "../../../shared/infrastructure/database.js"
import type { Operation } from "../../../shared/application/operation.js"
import type { WhatsappProvider } from "../application/ports.js"
import { notificationText } from "../application/messages.js"
import {
  staffNotificationRelevant,
  staffNotificationText,
} from "../application/staff-notifications.js"
import {
  customerMessageRelevant,
  customerWhatsappMessage,
  financialMessageDelayMs,
  isFinancialEvent,
} from "../application/customer-messages.js"
import type { SubscriptionCipher } from "./subscription-cipher.js"
import type { PushSender } from "./web-push.js"
export class NotificationWorker {
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<void> | undefined
  private stopped = true
  constructor(
    private readonly db: Database,
    private readonly cipher: SubscriptionCipher,
    private readonly whatsapp: WhatsappProvider,
    private readonly push: PushSender,
    private readonly operation: Operation,
  ) {}
  start() {
    if (!this.stopped) return
    this.stopped = false
    this.schedule()
  }
  private schedule() {
    if (this.stopped) return
    this.timer = setTimeout(() => {
      this.running = this.tick().finally(() => this.schedule())
    }, 1000)
    this.timer.unref()
  }
  async close() {
    this.stopped = true
    clearTimeout(this.timer)
    await this.running
  }
  async tick() {
    await this.operation.run("notifications.dispatch", async () => {
      const now = new Date(),
        expiredClaim = new Date(now.getTime() - 60000)
      // Unknown WhatsApp outcomes are deliberately never retried automatically.
      await this.db.run((tx) =>
        tx.notificationDelivery.updateMany({
          where: {
            state: "PROCESSING",
            claimedAt: { lt: expiredClaim },
            channel: "WHATSAPP",
          },
          data: { state: "UNKNOWN" },
        }),
      )
      await this.db.run((tx) =>
        tx.notificationDelivery.updateMany({
          where: {
            state: "PROCESSING",
            claimedAt: { lt: expiredClaim },
            channel: "PUSH",
          },
          data: { state: "PENDING", availableAt: now },
        }),
      )
      const events = await this.db.run((tx) =>
        tx.notificationEvent.findMany({
          where: { expandedAt: null },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { id: true },
        }),
      )
      for (const event of events) await this.expand(event.id, now)
      for (let i = 0; i < 5; i++) {
        const job = await this.claim()
        if (!job) break
        await this.deliver(job)
      }
    })
  }
  private expand(id: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const event = await tx.notificationEvent.findFirst({
        where: { id, expandedAt: null },
        include: {
          order: true,
          restaurant: { include: { channel: true, tenant: true } },
        },
      })
      if (!event) return
      const changed = await tx.notificationEvent.updateMany({
        where: { id, expandedAt: null },
        data: { expandedAt: now },
      })
      if (
        !changed.count ||
        !event.restaurant.tenant.active ||
        event.createdAt < new Date(now.getTime() - 24 * 3600000)
      )
        return
      const scope = { tenantId: event.tenantId, restaurantId: event.restaurantId },
        recipients: { channel: string; recipient: string }[] = []
      if (this.push.configured && event.kind !== "SUBSCRIBED") {
        const subscriptions = await tx.pushSubscription.findMany({
          where: {
            ...scope,
            expiresAt: { gt: now },
            createdAt: { lte: event.createdAt },
            OR: [{ orderId: event.orderId }, { userId: { not: null } }],
          },
          take: 1000,
        })
        const members = await tx.membership.findMany({
          where: {
            tenantId: scope.tenantId,
            userId: { in: subscriptions.flatMap((s) => (s.userId ? [s.userId] : [])) },
            active: true,
            user: { active: true },
          },
        })
        const sessions = await tx.session.findMany({
          where: {
            id: { in: subscriptions.flatMap((s) => (s.sessionId ? [s.sessionId] : [])) },
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, userId: true },
        })
        for (const sub of subscriptions) {
          if (!sub.userId && !customerMessageRelevant(event, event.order)) continue
          if (sub.userId) {
            const member = members.find((m) => m.userId === sub.userId)
            if (
              !sessions.some((s) => s.id === sub.sessionId && s.userId === sub.userId) ||
              !member ||
              !staffNotificationRelevant(member.role, sub.userId, event, event.order)
            )
              continue
          }
          recipients.push({ channel: "PUSH", recipient: sub.id })
        }
      }
      if (
        this.whatsapp.configured &&
        customerMessageRelevant(event, event.order) &&
        event.restaurant.channel?.whatsappEnabled &&
        event.order.whatsappConsentAt &&
        !event.order.whatsappRevokedAt &&
        event.order.whatsappConsentAt <= event.createdAt
      )
        recipients.push({ channel: "WHATSAPP", recipient: event.orderId })
      if (recipients.length)
        await tx.notificationDelivery.createMany({
          data: recipients.map((r) => ({
            ...r,
            id: randomUUID(),
            eventId: id,
            availableAt:
              r.channel === "WHATSAPP" && isFinancialEvent(event)
                ? new Date(
                    Math.max(
                      now.getTime(),
                      event.createdAt.getTime() + financialMessageDelayMs,
                    ),
                  )
                : now,
          })),
          skipDuplicates: true,
        })
    })
  }
  private claim() {
    return this.db.transaction(async (tx) => {
      const now = new Date(),
        job = await tx.notificationDelivery.findFirst({
          where: { state: "PENDING", availableAt: { lte: now } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { event: true },
        })
      if (!job) return null
      if (
        await tx.notificationDelivery.count({
          where: {
            state: "PROCESSING",
            channel: job.channel,
            event: {
              orderId: job.event.orderId,
              tenantId: job.event.tenantId,
              restaurantId: job.event.restaurantId,
            },
          },
        })
      )
        return null
      const updated = await tx.notificationDelivery.updateMany({
        where: { id: job.id, state: "PENDING" },
        data: { state: "PROCESSING", claimedAt: now, attempts: { increment: 1 } },
      })
      return updated.count ? { ...job, attempts: job.attempts + 1, claimedAt: now } : null
    })
  }
  private async deliver(
    job: NonNullable<Awaited<ReturnType<NotificationWorker["claim"]>>>,
  ) {
    let state = "SKIPPED",
      retry = false,
      whatsappAttempted = false
    try {
      const event = job.event,
        scope = { tenantId: event.tenantId, restaurantId: event.restaurantId },
        now = new Date()
      const order = await this.db.run((tx) =>
        tx.order.findFirst({
          where: {
            ...scope,
            id: event.orderId,
            restaurant: { tenant: { active: true } },
          },
          include: { restaurant: { include: { channel: true } } },
        }),
      )
      if (order && event.createdAt >= new Date(now.getTime() - 24 * 3600000)) {
        const text = notificationText(event)
        if (
          job.channel === "WHATSAPP" &&
          order.restaurant.channel?.whatsappEnabled &&
          order.whatsappConsentAt &&
          order.whatsappConsentAt <= event.createdAt &&
          !order.whatsappRevokedAt &&
          customerMessageRelevant(event, order)
        ) {
          // Coalesce successive manual receipts/reversals into the most recent balance.
          // The transaction keeps the selected financial event and summed cents consistent.
          const finance = isFinancialEvent(event)
            ? await this.db.transaction(async (tx) => {
                const latest = await tx.notificationEvent.findFirst({
                  where: {
                    ...scope,
                    orderId: order.id,
                    kind: { in: ["PAYMENT", "REVERSAL"] },
                  },
                  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                  select: { id: true },
                })
                const received = await tx.payment.aggregate({
                  where: { ...scope, orderId: order.id, reversedAt: null },
                  _sum: { amount: true },
                })
                return {
                  current: latest?.id === event.id,
                  paid: received._sum.amount ?? 0,
                }
              })
            : null
          if (finance && !finance.current) {
            await this.finish(job, "SKIPPED", false)
            return
          }
          const message = customerWhatsappMessage(event, order, finance?.paid)
          const customer = order.customer as { phone?: unknown },
            raw =
              typeof customer.phone === "string" ? customer.phone.replace(/\D/g, "") : "",
            number = raw.length === 10 || raw.length === 11 ? `55${raw}` : raw
          let connected = false
          try {
            connected = (await this.whatsapp.state(scope)).state === "connected"
          } catch {
            /* No message was attempted: retrying a connectivity check is safe. */
          }
          if (!connected) {
            retry = job.attempts < 5
            state = retry ? "PENDING" : "FAILED"
          } else if (/^55\d{10,11}$/.test(number)) {
            whatsappAttempted = true
            state = await this.whatsapp.send(scope, number, message)
          } else state = "FAILED"
        } else if (job.channel === "PUSH") {
          const sub = await this.db.run((tx) =>
            tx.pushSubscription.findFirst({
              where: { ...scope, id: job.recipient, expiresAt: { gt: now } },
            }),
          )
          let allowed =
            !!sub &&
            sub.orderId === order.id &&
            event.kind !== "SUBSCRIBED" &&
            customerMessageRelevant(event, order)
          if (sub?.userId) {
            const session = sub.sessionId
              ? await this.db.run((tx) =>
                  tx.session.findFirst({
                    where: {
                      id: sub.sessionId!,
                      userId: sub.userId!,
                      revokedAt: null,
                      expiresAt: { gt: now },
                    },
                    select: { id: true },
                  }),
                )
              : null
            const member = await this.db.run((tx) =>
              tx.membership.findFirst({
                where: {
                  tenantId: scope.tenantId,
                  userId: sub.userId!,
                  active: true,
                  user: { active: true },
                },
              }),
            )
            allowed =
              !!session &&
              !!member &&
              staffNotificationRelevant(member.role, sub.userId, event, order)
          }
          if (sub && allowed) {
            const content = sub.userId ? staffNotificationText(event) : text
            const result = await this.push.send(this.cipher.open(sub.encrypted), {
              title: content.title,
              body: content.message,
              tag: `order:${order.id}:${isFinancialEvent(event) ? "payment" : "stage"}`,
              url: sub.userId
                ? `/admin/orders?restaurant=${scope.restaurantId}`
                : `/menu/${order.restaurant.slug}`,
            })
            if (result === "EXPIRED") {
              await this.db.run((tx) =>
                tx.pushSubscription.deleteMany({ where: { ...scope, id: sub.id } }),
              )
              state = "SKIPPED"
            } else if (result === "RETRY") {
              retry = job.attempts < 5
              state = retry ? "PENDING" : "FAILED"
            } else state = result
          }
        }
      }
    } catch (cause) {
      this.operation.error("notifications.delivery", cause)
      // A failed preflight did not submit a message and can safely be retried.
      // Once send has been called, an exception may hide an accepted message.
      retry = job.channel === "WHATSAPP" && !whatsappAttempted && job.attempts < 5
      state =
        job.channel === "WHATSAPP" && whatsappAttempted
          ? "UNKNOWN"
          : retry
            ? "PENDING"
            : "FAILED"
    }
    if (state === "FAILED" || state === "UNKNOWN")
      this.operation.error(
        "notifications.delivery-outcome",
        new Failure(
          "CAPABILITY_UNAVAILABLE",
          "Envio não confirmado. Consulte o histórico de envios da loja.",
          {},
          `notification_${job.channel.toLowerCase()}_${state.toLowerCase()}`,
        ),
      )
    await this.finish(job, state, retry)
  }
  private finish(
    job: NonNullable<Awaited<ReturnType<NotificationWorker["claim"]>>>,
    state: string,
    retry: boolean,
  ) {
    return this.db.run((tx) =>
      tx.notificationDelivery.updateMany({
        where: { id: job.id, state: "PROCESSING", claimedAt: job.claimedAt },
        data: {
          state,
          ...(retry
            ? {
                availableAt: new Date(
                  Date.now() + Math.min(3600000, 5000 * 2 ** job.attempts),
                ),
              }
            : {}),
        },
      }),
    )
  }
}
