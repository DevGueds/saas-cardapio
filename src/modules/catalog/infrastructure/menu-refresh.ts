export class MenuRefresh {
  private readonly listeners = new Map<string, Set<() => void>>()
  subscribe(id: string, listener: () => void) {
    const group = this.listeners.get(id) ?? new Set<() => void>()
    group.add(listener)
    this.listeners.set(id, group)
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(`cardapio:api:${id}`)
        : null
    const timer = window.setInterval(listener, 20000)
    const onFocus = () => listener()
    window.addEventListener("focus", onFocus)
    if (channel) channel.onmessage = listener
    return () => {
      group.delete(listener)
      if (!group.size) this.listeners.delete(id)
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      channel?.close()
    }
  }
  changed(id: string) {
    this.listeners.get(id)?.forEach((listener) => listener())
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`cardapio:api:${id}`)
      channel.postMessage("changed")
      channel.close()
    }
  }
}
