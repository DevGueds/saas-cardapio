import webpush from "web-push"
import type { PushInput } from "../application/ports.js"
export interface PushSender {
  readonly configured: boolean
  send(
    subscription: PushInput,
    payload: { title: string; body: string; tag: string; url: string },
  ): Promise<"SENT" | "EXPIRED" | "FAILED" | "RETRY">
}
export class WebPushSender implements PushSender {
  readonly configured: boolean
  constructor(
    private readonly subject: string,
    private readonly publicKey: string,
    private readonly privateKey: string,
  ) {
    this.configured = !!subject && !!publicKey && !!privateKey
  }
  async send(
    subscription: PushInput,
    payload: { title: string; body: string; tag: string; url: string },
  ): Promise<"SENT" | "EXPIRED" | "FAILED" | "RETRY"> {
    if (!this.configured) return "FAILED"
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 3600,
        urgency: "normal",
        timeout: 10000,
        vapidDetails: {
          subject: this.subject,
          publicKey: this.publicKey,
          privateKey: this.privateKey,
        },
      })
      return "SENT"
    } catch (error) {
      const status =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0
      return status === 404 || status === 410
        ? "EXPIRED"
        : !status || status === 429 || status >= 500
          ? "RETRY"
          : "FAILED"
    }
  }
}
