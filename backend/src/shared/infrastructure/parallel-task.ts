import { fork, type ChildProcess, type ForkOptions } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { Bulkhead } from "../application/bulkhead.js"
import { Failure } from "@cardapio/domain/failure"

type Callback = (input: unknown) => unknown
interface WorkerBridge {
  onmessage?: (event: { data: unknown }) => void
  onerror?: (error: Error) => void
  postMessage(data: unknown): void
  terminate(): void
}
interface Engine {
  getWorkerSource(callback: Callback, env: Record<string, unknown>): string
  _spawnWorker(callback: Callback, env: Record<string, unknown>): WorkerBridge
  spawn(callback: Callback, env: Record<string, unknown>): Engine
  then(success: (data: unknown) => void, failure: (error: unknown) => void): Engine
}
// Pinned 1.1.0: its built-in Node Worker inherits secrets and misses early exits.
// Keep its task/serialization engine; adapt process lifecycle at this tested seam.
const Parallel = createRequire(import.meta.url)("paralleljs") as {
  new (input: unknown, options: Record<string, unknown>): Engine
}
const bootstrap = fileURLToPath(new URL("./parallel-bootstrap.cjs", import.meta.url))
const unavailable = (cause: string) =>
  new Failure(
    "CAPABILITY_UNAVAILABLE",
    "O processamento está ocupado ou indisponível. Tente novamente em instantes.",
    {},
    cause,
  )

class IsolatedParallel extends Parallel {
  private child: ChildProcess | undefined
  private exited: Promise<void> = Promise.resolve()
  override _spawnWorker(callback: Callback, env: Record<string, unknown>): WorkerBridge {
    const options: ForkOptions & { windowsHide: boolean } = {
      execArgv: ["--max-old-space-size=64", "--max-semi-space-size=8"],
      env: {
        TZ: "UTC",
        ...(process.platform === "win32" && process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "json",
      windowsHide: true,
    }
    const child = fork(bootstrap, [], options)
    this.child = child
    let finished = false
    const worker: WorkerBridge = {
      postMessage(data) {
        if (!child.connected) {
          worker.onerror?.(unavailable("parallel_disconnected"))
          return
        }
        child.send(JSON.stringify({ data }), (error) => {
          if (error && !finished) worker.onerror?.(unavailable("parallel_ipc_failed"))
        })
      },
      terminate() {
        finished = true
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
      },
    }
    this.exited = new Promise<void>((resolve) =>
      child.once("close", () => {
        resolve()
        if (!finished) worker.onerror?.(unavailable("parallel_worker_exited"))
      }),
    )
    child.on("error", () => {
      if (!finished) worker.onerror?.(unavailable("parallel_worker_failed"))
    })
    child.on("message", (message: unknown) => {
      if (finished) return
      try {
        if (typeof message !== "string" || Buffer.byteLength(message) > 1_000_000)
          throw new Error()
        const data: unknown = JSON.parse(message)
        finished = true
        worker.onmessage?.({ data })
      } catch {
        worker.onerror?.(unavailable("parallel_output_invalid"))
      }
    })
    worker.postMessage(this.getWorkerSource(callback, env))
    return worker
  }
  async stop() {
    if (!this.child) return
    const child = this.child
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    }, 500)
    try {
      await this.exited
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Bounded CPU jobs only. Never receives caller-defined code or performs I/O writes. */
export class ParallelTaskRunner {
  private readonly capacity: Bulkhead
  private readonly pending = new Set<() => void>()
  private readonly tasks = new Set<IsolatedParallel>()
  private closed = false
  constructor(
    private readonly maximum = 2,
    private readonly timeoutMs = 7000,
  ) {
    if (
      !Number.isInteger(maximum) ||
      maximum < 1 ||
      maximum > 4 ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 10 ||
      timeoutMs > 30000
    )
      throw new Error("invalid_parallel_limits")
    this.capacity = new Bulkhead(maximum)
  }
  get active() {
    return this.capacity.inFlight
  }
  async run(
    input: unknown,
    callback: Callback,
    env: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (this.closed) throw unavailable("parallel_closed")
    const release = this.capacity.enter()
    let task: IsolatedParallel | undefined
    try {
      const encoded = JSON.stringify(input)
      if (typeof encoded !== "string" || Buffer.byteLength(encoded) > 2_000_000)
        throw unavailable("parallel_input_limit")
      task = new IsolatedParallel(input, { maxWorkers: 1, synchronous: false, env: {} })
      this.tasks.add(task)
      return await new Promise<unknown>((resolve, reject) => {
        let settled = false
        const finish = (error: unknown, output?: unknown) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          this.pending.delete(cancel)
          void task!.stop().then(
            () => (error ? reject(error) : resolve(output)),
            () => reject(unavailable("parallel_cleanup_failed")),
          )
        }
        const cancel = () => finish(unavailable("parallel_closed"))
        const timer = setTimeout(
          () => finish(unavailable("parallel_timeout")),
          this.timeoutMs,
        )
        this.pending.add(cancel)
        try {
          task!.spawn(callback, env).then(
            (output) => finish(null, output),
            (error) =>
              finish(
                error instanceof Failure
                  ? error
                  : unavailable("parallel_computation_failed"),
              ),
          )
        } catch {
          finish(unavailable("parallel_start_failed"))
        }
      })
    } finally {
      try {
        await task?.stop()
      } finally {
        if (task) this.tasks.delete(task)
        release()
      }
    }
  }
  async close() {
    this.closed = true
    for (const cancel of [...this.pending]) cancel()
    await Promise.allSettled([...this.tasks].map((task) => task.stop()))
  }
}
