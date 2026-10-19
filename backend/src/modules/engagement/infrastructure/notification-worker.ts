import { randomUUID } from "node:crypto"
import { can } from "@cardapio/domain/permissions"
import { Failure } from "@cardapio/domain/failure"
import type { Database } from "../../../shared/infrastructure/database.js"
import type { Operation } from "../../../shared/application/operation.js"
import type { WhatsappProvider } from "../application/ports.js"
import { notificationText } from "../application/messages.js"
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
      if (this.push.configured) {
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
          if (sub.userId) {
            const member = members.find((m) => m.userId === sub.userId)
            if (
              !sessions.some((s) => s.id === sub.sessionId && s.userId === sub.userId) ||
              !member ||
              !can(member.role, "orders:read") ||
              (event.kind !== "ORDER" && !can(member.role, "payments:read")) ||
              (member.role === "COURIER" && event.order.courierId !== sub.userId)
            )
              continue
          }
          recipients.push({ channel: "PUSH", recipient: sub.id })
        }
      }
      if (
        this.whatsapp.configured &&
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
            availableAt: now,
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
      retry = false
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
          !order.whatsappRevokedAt
        ) {
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
          } else
            state = /^55\d{10,11}$/.test(number)
              ? await this.whatsapp.send(
                  scope,
                  number,
                  `${order.restaurant.name}\n${text.title}\n${text.message}\nPara interromper estas mensagens, desative o WhatsApp no acompanhamento do pedido.`,
                )
              : "FAILED"
        } else if (job.channel === "PUSH") {
          const sub = await this.db.run((tx) =>
            tx.pushSubscription.findFirst({
              where: { ...scope, id: job.recipient, expiresAt: { gt: now } },
            }),
          )
          let allowed = !!sub && sub.orderId === order.id
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
              can(member.role, "orders:read") &&
              (event.kind === "ORDER" || can(member.role, "payments:read")) &&
              (member.role !== "COURIER" || order.courierId === sub.userId)
          }
          if (sub && allowed) {
            const result = await this.push.send(this.cipher.open(sub.encrypted), {
              title: text.title,
              body: text.message,
              tag: event.id,
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
      state = job.channel === "WHATSAPP" ? "UNKNOWN" : "FAILED"
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
    await this.db.run((tx) =>
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
