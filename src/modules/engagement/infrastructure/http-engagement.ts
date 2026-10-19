import { z } from "zod"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import {
  boardSnapshotSchema,
  boardDeltaSchema,
  channelSettingsSchema,
  inboxSchema,
  whatsappStateSchema,
  deliveriesSchema,
  pushSettingsSchema,
  customerPreferencesSchema,
} from "@cardapio/contracts"
import type { ApiClient } from "../../../shared/infrastructure/api-client"
import { waitForNetworkRetry } from "../../../shared/infrastructure/network-retry"
import type { EngagementService, PushTarget } from "../application/ports"
const done = z.unknown().transform(() => undefined)
const storePath = (id: string) => `/restaurants/${encodeURIComponent(id)}`
const customerPath = (target: Extract<PushTarget, { slug: string }>) =>
  `/public/restaurants/${encodeURIComponent(target.slug)}/orders/${encodeURIComponent(target.orderId)}`
export class HttpEngagement implements EngagementService {
  constructor(private readonly client: ApiClient) {}
  settings(id: string) {
    return this.client.request(`${storePath(id)}/channels`, channelSettingsSchema)
  }
  update(...[id, input]: Parameters<EngagementService["update"]>) {
    return this.client.request(`${storePath(id)}/channels`, channelSettingsSchema, {
      method: "PUT",
      body: input,
    })
  }
  inbox(id: string) {
    return this.client.request(`${storePath(id)}/notifications`, inboxSchema)
  }
  read(id: string, before: string) {
    return this.client.request(`${storePath(id)}/notifications/read`, done, {
      method: "POST",
      body: { before },
    })
  }
  whatsapp(id: string, action: "state" | "connect" | "disconnect") {
    return this.client.request(
      `${storePath(id)}/whatsapp${action === "connect" ? "/connect" : ""}`,
      whatsappStateSchema,
      { method: action === "state" ? "GET" : action === "connect" ? "POST" : "DELETE" },
    )
  }
  deliveries(id: string) {
    return this.client.request(
      `${storePath(id)}/notification-deliveries`,
      deliveriesSchema,
    )
  }
  pushConfiguration() {
    return this.client.request("/public/push/configuration", pushSettingsSchema)
  }
  push(...[target, subscription, remove]: Parameters<EngagementService["push"]>) {
    return this.client.request(
      `${"restaurantId" in target ? storePath(target.restaurantId) : customerPath(target)}/push`,
      done,
      {
        method: remove ? "DELETE" : "POST",
        body: subscription,
        ...("token" in target ? { trackingToken: target.token } : {}),
      },
    )
  }
  preferences(target: Extract<PushTarget, { slug: string }>) {
    return this.client.request(
      `${customerPath(target)}/notifications`,
      customerPreferencesSchema,
      { trackingToken: target.token },
    )
  }
  consent(target: Extract<PushTarget, { slug: string }>, whatsapp: boolean) {
    return this.client.request(`${customerPath(target)}/notifications`, done, {
      method: "PUT",
      body: { whatsapp },
      trackingToken: target.token,
    })
  }
  async board(
    ...[slug, token, callbacks, signal]: Parameters<EngagementService["board"]>
  ) {
    let fatal = false
    while (!signal.aborted && !fatal) {
      if (!navigator.onLine) {
        callbacks.status(
          false,
          "Sem conexão. O painel será atualizado quando a rede voltar.",
        )
        await waitForNetworkRetry(signal, 3000)
        continue
      }
      const attempt = new AbortController(),
        abort = () => attempt.abort(),
        offline = () => {
          callbacks.status(
            false,
            "Sem conexão. O painel será atualizado quando a rede voltar.",
          )
          attempt.abort()
        }
      signal.addEventListener("abort", abort, { once: true })
      window.addEventListener("offline", offline)
      let lastMessage = Date.now()
      const watchdog = setInterval(() => {
        if (Date.now() - lastMessage > 20000) {
          callbacks.status(false, "Conexão interrompida. Reconectando…")
          attempt.abort()
        }
      }, 5000)
      try {
        await fetchEventSource(
          this.client.endpoint(
            `/public/restaurants/${encodeURIComponent(slug)}/board/stream`,
          ),
          {
            signal: attempt.signal,
            headers: { "X-Board-Key": token },
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            openWhenHidden: true,
            onopen: async (response) => {
              if (
                !response.ok ||
                !response.headers.get("content-type")?.includes("text/event-stream")
              ) {
                fatal = [401, 403, 404, 422].includes(response.status)
                callbacks.status(
                  false,
                  fatal
                    ? "Painel desativado ou link expirado. Solicite um novo link à loja."
                    : "Painel indisponível. Reconectando…",
                )
                throw new Error("stream_unavailable")
              }
              lastMessage = Date.now()
            },
            onmessage: (event) => {
              if (signal.aborted || attempt.signal.aborted || !navigator.onLine) return
              lastMessage = Date.now()
              if (event.event === "snapshot") {
                callbacks.snapshot(boardSnapshotSchema.parse(JSON.parse(event.data)))
                callbacks.status(true, "Atualizado ao vivo")
              } else if (event.event === "delta") {
                callbacks.delta(boardDeltaSchema.parse(JSON.parse(event.data)))
                callbacks.status(true, "Atualizado ao vivo")
              } else if (event.event === "heartbeat")
                callbacks.status(true, "Atualizado ao vivo")
              else if (event.event === "unavailable") {
                callbacks.status(false, "Conexão interrompida. Reconectando…")
                throw new Error("stream_unavailable")
              }
            },
            onerror: () => {
              throw new Error("stream_interrupted")
            },
            onclose: () => {
              throw new Error("stream_closed")
            },
          },
        )
      } catch {
        if (!signal.aborted && !fatal)
          callbacks.status(false, "Conexão interrompida. Reconectando…")
      } finally {
        clearInterval(watchdog)
        window.removeEventListener("offline", offline)
        signal.removeEventListener("abort", abort)
        attempt.abort()
      }
      if (!signal.aborted && !fatal) await waitForNetworkRetry(signal, 3000)
    }
  }
}
