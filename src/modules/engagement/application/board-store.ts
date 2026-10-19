import type { BoardOrder, BoardSnapshot } from "@cardapio/contracts"
export const boardStages = ["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const
const empty: readonly string[] = []
export class BoardStore {
  private rows = new Map<string, BoardOrder>()
  private columns = new Map<BoardOrder["status"], readonly string[]>()
  private listeners = new Map<string, Set<() => void>>()
  private meta = {
    name: "Acompanhe seu pedido",
    connected: false,
    message: "Conectando ao painel…",
    truncated: false,
  }
  subscribe = (key: string, listener: () => void) => {
    const set = this.listeners.get(key) ?? new Set()
    set.add(listener)
    this.listeners.set(key, set)
    return () => {
      set.delete(listener)
      if (!set.size) this.listeners.delete(key)
    }
  }
  get = (id: string) => this.rows.get(id)
  column = (status: BoardOrder["status"]) => this.columns.get(status) ?? empty
  metadata = () => this.meta
  private notify(key: string) {
    this.listeners.get(key)?.forEach((fn) => fn())
  }
  status = (connected: boolean, message: string) => {
    if (this.meta.connected === connected && this.meta.message === message) return
    this.meta = { ...this.meta, connected, message }
    this.notify("meta")
  }
  snapshot = (value: BoardSnapshot) =>
    this.delta({
      name: value.name,
      truncated: value.truncated,
      upsert: value.orders,
      remove: [...this.rows.keys()].filter(
        (id) => !value.orders.some((o) => o.id === id),
      ),
    })
  delta = (value: {
    upsert: BoardOrder[]
    remove: string[]
    name: string
    truncated: boolean
  }) => {
    const changed = new Set<string>()
    for (const id of value.remove) if (this.rows.delete(id)) changed.add(id)
    for (const row of value.upsert) {
      const old = this.rows.get(row.id)
      if (!old || old.status !== row.status || old.createdAt !== row.createdAt) {
        this.rows.set(row.id, row)
        changed.add(row.id)
      }
    }
    for (const stage of boardStages) {
      const next = [...this.rows.values()]
          .filter((r) => r.status === stage)
          .sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          )
          .map((r) => r.id),
        previous = this.column(stage)
      if (
        next.length !== previous.length ||
        next.some((id, index) => id !== previous[index])
      ) {
        this.columns.set(stage, next)
        this.notify(`column:${stage}`)
      }
    }
    changed.forEach((id) => this.notify(id))
    if (this.meta.name !== value.name || this.meta.truncated !== value.truncated) {
      this.meta = { ...this.meta, name: value.name, truncated: value.truncated }
      this.notify("meta")
    }
  }
}
