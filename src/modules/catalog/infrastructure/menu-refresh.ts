import type { MenuDocument } from "../application/menu-document"
type Listener = (menu?: MenuDocument) => void
export class MenuRefresh {
  private readonly listeners = new Map<string, Set<Listener>>()
  subscribe(id: string, listener: Listener) {
    const group = this.listeners.get(id) ?? new Set<Listener>()
    group.add(listener)
    this.listeners.set(id, group)
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(`cardapio:api:${id}`)
        : null
    const onFocus = () => listener()
    const timer = window.setInterval(onFocus, 20000)
    window.addEventListener("focus", onFocus)
    if (channel) channel.onmessage = onFocus
    return () => {
      group.delete(listener)
      if (!group.size) this.listeners.delete(id)
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      channel?.close()
    }
  }
  changed(id: string, menu?: MenuDocument) {
    this.listeners.get(id)?.forEach((listener) => listener(menu))
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`cardapio:api:${id}`)
      channel.postMessage("changed")
      channel.close()
    }
  }
}
