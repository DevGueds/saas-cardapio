import { pushSubscriptionSchema } from "@cardapio/contracts"
import { Failure } from "../domain/failure"
import type { Executor } from "../application/execute"
import type { DevicePush } from "../application/push"
export class BrowserPush implements DevicePush {
  constructor(private readonly executor: Executor) {}
  unsupported() {
    if (!window.isSecureContext)
      return "Os alertas deste aparelho precisam de HTTPS. No ambiente local, use localhost neste computador."
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return "Este navegador não oferece alertas push. No iPhone/iPad, adicione o cardápio à Tela de Início e abra por lá."
    if (Notification.permission === "denied")
      return "As notificações estão bloqueadas no navegador. Libere a permissão nas configurações do site."
    return null
  }
  subscribe(publicKey: string) {
    return this.executor.run("push", "subscribe", async () => {
      const unsupported = this.unsupported()
      if (unsupported) throw new Failure("CAPABILITY_UNAVAILABLE", unsupported)
      if ((await Notification.requestPermission()) !== "granted")
        throw new Failure(
          "ACCESS_DENIED",
          "A permissão para notificações não foi concedida. Você pode continuar acompanhando pela tela.",
        )
      const registration = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}notifications-sw.js`,
        { scope: import.meta.env.BASE_URL },
      )
      if (!registration.active)
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () =>
                reject(
                  new Failure(
                    "CAPABILITY_UNAVAILABLE",
                    "O serviço de notificações está iniciando. Tente novamente.",
                  ),
                ),
              10000,
            )
            void navigator.serviceWorker.ready.then(() => clearTimeout(timer))
          }),
        ])
      const existing = await registration.pushManager.getSubscription()
      const bytes = Uint8Array.from(
        atob(
          publicKey.replace(/-/g, "+").replace(/_/g, "/") +
            "=".repeat((4 - (publicKey.length % 4)) % 4),
        ),
        (c) => c.charCodeAt(0),
      )
      if (
        existing?.options.applicationServerKey &&
        new Uint8Array(existing.options.applicationServerKey).some(
          (value, index) => value !== bytes[index],
        )
      ) {
        await existing.unsubscribe()
        throw new Failure(
          "CONFLICT",
          "A configuração de notificações mudou. Ative os alertas novamente.",
        )
      }
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }))
      const json = subscription.toJSON()
      return pushSubscriptionSchema.parse({ endpoint: json.endpoint, keys: json.keys })
    })
  }
  current() {
    return this.executor.run("push", "current", async () => {
      if (!("serviceWorker" in navigator)) return null
      const registration = await navigator.serviceWorker.getRegistration(
          import.meta.env.BASE_URL,
        ),
        subscription = await registration?.pushManager.getSubscription()
      return subscription ? { endpoint: subscription.endpoint } : null
    })
  }
}
