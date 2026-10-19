import { timer, exhaustMap, shareReplay, type Observable, type Subscription } from "rxjs"
import { Failure } from "@cardapio/domain/failure"
import type { BoardSnapshot, Result } from "@cardapio/contracts"
import type { FastifyReply } from "fastify"
import type { Engagement } from "../application/engagement.js"
// One DB projection per store/link per replica, shared by all connected screens.
export class BoardStreams {
  private readonly groups = new Map<
    string,
    { stream: Observable<Result<BoardSnapshot>>; count: number }
  >()
  private readonly clients = new Set<() => void>()
  constructor(private readonly engagement: Engagement) {}
  open(slug: string, token: string, reply: FastifyReply, initial: BoardSnapshot) {
    if (
      this.clients.size >= 128 ||
      (!this.groups.has(`${slug}:${token}`) && this.groups.size >= 32)
    )
      throw new Failure(
        "CAPABILITY_UNAVAILABLE",
        "Painel ocupado. A conexão será repetida em instantes.",
      )
    const key = `${slug}:${token}`
    let group = this.groups.get(key)
    if (!group) {
      group = {
        count: 0,
        stream: timer(2000, 2000).pipe(
          exhaustMap(() => this.engagement.board(slug, token)),
          shareReplay({ bufferSize: 1, refCount: true }),
        ),
      }
      this.groups.set(key, group)
    }
    group.count++
    reply.hijack()
    const headers = {
      ...Object.fromEntries(
        Object.entries(reply.getHeaders())
          .filter(([, value]) => value !== undefined)
          .map(([name, value]) => [name, Array.isArray(value) ? value : String(value)]),
      ),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    }
    reply.raw.writeHead(200, headers)
    let previous = initial,
      closed = false
    const lifecycle: { subscription?: Subscription } = {}
    const close = () => {
      if (closed) return
      closed = true
      lifecycle.subscription?.unsubscribe()
      this.clients.delete(close)
      group!.count--
      if (!group!.count) this.groups.delete(key)
      reply.raw.end()
    }
    const write = (event: string, data: unknown) => {
      if (closed) return
      if (!reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) close()
    }
    this.clients.add(close)
    reply.raw.on("close", close)
    reply.raw.on("error", close)
    write("snapshot", initial)
    lifecycle.subscription = group.stream.subscribe({
      next: (result) => {
        if (!result.ok) {
          write("unavailable", { message: result.error.message })
          close()
          return
        }
        const next = result.value,
          before = new Map(previous.orders.map((o) => [o.id, o])),
          ids = new Set(next.orders.map((o) => o.id))
        const upsert = next.orders.filter((o) => {
            const old = before.get(o.id)
            return !old || old.status !== o.status || old.createdAt !== o.createdAt
          }),
          remove = previous.orders.filter((o) => !ids.has(o.id)).map((o) => o.id)
        if (
          upsert.length ||
          remove.length ||
          previous.name !== next.name ||
          previous.truncated !== next.truncated
        )
          write("delta", { upsert, remove, name: next.name, truncated: next.truncated })
        else write("heartbeat", {})
        previous = next
      },
      error: () => {
        write("unavailable", { message: "Conexão interrompida. Reconectando…" })
        close()
      },
    })
    if (closed) lifecycle.subscription.unsubscribe()
  }
  close() {
    for (const close of [...this.clients]) close()
  }
}
