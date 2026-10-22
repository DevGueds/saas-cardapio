"use strict"

// Never forward provider output. Dependencies also write outside console/Pino,
// so the entire process tree inherits pipes, not Docker's output descriptors.
const { spawn } = require("node:child_process")
const { StringDecoder } = require("node:string_decoder")

const levels = new Set(["trace", "debug", "info", "warn", "error", "fatal"])
const numericLevels = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
}
const codes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EACCES",
  "EPERM",
  "ENOENT",
  "ENOMEM",
  "ENOSPC",
  "ERR_STREAM_DESTROYED",
  "ERR_SOCKET_CLOSED",
  "ERR_INVALID_ARG_TYPE",
  "ERR_INVALID_ARG_VALUE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
])
const types = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "AggregateError",
])
const events = new Set([
  "connection.update",
  "connection.open",
  "connection.close",
  "creds.update",
  "messages.upsert",
  "messages.update",
  "messages.delete",
])
const signals = new Set(["SIGTERM", "SIGINT", "SIGHUP", "SIGKILL", "SIGABRT", "SIGSEGV"])
const maximumLineBytes = 16 * 1024

function allowed(value, whitelist) {
  return typeof value === "string" && whitelist.has(value) ? value : undefined
}

function metadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const nested = value.err && typeof value.err === "object" ? value.err : value.error
  return {
    level:
      allowed(value.level, levels) ??
      (typeof value.level === "number" && Object.hasOwn(numericLevels, value.level)
        ? numericLevels[value.level]
        : undefined),
    code: allowed(value.code, codes) ?? allowed(nested?.code, codes),
    type:
      allowed(value.type, types) ??
      allowed(value.name, types) ??
      allowed(nested?.type, types) ??
      allowed(nested?.name, types),
    event: allowed(value.event, events),
  }
}

function createCollector(emit) {
  let pending
  function reset() {
    pending = {
      records: { stdout: 0, stderr: 0 },
      oversized: 0,
      levels: {},
      codes: {},
      types: {},
      events: {},
    }
  }
  reset()
  function increment(target, key) {
    if (key) target[key] = Math.min(Number.MAX_SAFE_INTEGER, (target[key] ?? 0) + 1)
  }
  function record(stream, line, oversized = false) {
    increment(pending.records, stream)
    if (oversized) pending.oversized += 1
    let data = {}
    if (!oversized) {
      try {
        data = metadata(JSON.parse(line))
      } catch {
        /* Raw text is intentionally discarded. */
      }
    }
    increment(pending.levels, data.level ?? (stream === "stderr" ? "error" : "info"))
    increment(pending.codes, data.code)
    increment(pending.types, data.type)
    increment(pending.events, data.event)
  }
  function flush() {
    if (pending.records.stdout + pending.records.stderr === 0) return
    emit(pending.records.stderr ? "stderr" : "stdout", {
      event: "provider_output_summary",
      level: pending.levels.error || pending.levels.fatal ? "error" : "info",
      ...pending,
    })
    reset()
  }
  function streamReader(stream) {
    const decoder = new StringDecoder("utf8")
    let buffered = ""
    let byteLength = 0
    let oversized = false
    function consume(text) {
      let offset = 0
      do {
        const newline = text.indexOf("\n", offset)
        const end = newline === -1 ? text.length : newline
        const fragment = text.slice(offset, end)
        if (!oversized) {
          byteLength += Buffer.byteLength(fragment)
          if (byteLength > maximumLineBytes) {
            oversized = true
            buffered = ""
          } else buffered += fragment
        }
        if (newline === -1) break
        record(stream, buffered, oversized)
        buffered = ""
        byteLength = 0
        oversized = false
        offset = newline + 1
      } while (offset < text.length)
    }
    return {
      write(chunk) {
        consume(decoder.write(chunk))
      },
      end() {
        consume(decoder.end())
        if (buffered || oversized) record(stream, buffered, oversized)
        buffered = ""
        byteLength = 0
        oversized = false
      },
    }
  }
  return { streamReader, flush }
}

function run(command, args) {
  const emit = (stream, record) =>
    process[stream].write(
      JSON.stringify({
        time: new Date().toISOString(),
        component: "evolution",
        ...record,
      }) + "\n",
    )
  // A closed log collector must not turn into an unhandled exception with a stack.
  process.stdout.on("error", () => {})
  process.stderr.on("error", () => {})
  if (!command) {
    emit("stderr", { event: "provider_supervisor_error", level: "error", code: "ENOENT" })
    process.exitCode = 1
    return
  }
  const collector = createCollector(emit)
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  })
  for (const stream of ["stdout", "stderr"]) {
    const reader = collector.streamReader(stream)
    child[stream].on("data", (chunk) => reader.write(chunk))
    child[stream].on("end", () => reader.end())
    child[stream].on("error", () => {
      emit("stderr", { event: "provider_stream_error", level: "error" })
    })
  }
  const timer = setInterval(() => collector.flush(), 5_000)
  timer.unref()
  const handlers = new Map()
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    const handler = () => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal)
        else child.kill(signal)
      } catch {
        /* A process that already exited needs no signal. */
      }
    }
    handlers.set(signal, handler)
    process.on(signal, handler)
  }
  child.on("spawn", () =>
    emit("stdout", { event: "provider_process_started", level: "info" }),
  )
  child.on("error", (error) => {
    emit("stderr", {
      event: "provider_supervisor_error",
      level: "error",
      ...metadata(error),
    })
  })
  child.on("close", (code, signal) => {
    clearInterval(timer)
    collector.flush()
    for (const [name, handler] of handlers) process.off(name, handler)
    const exitCode = Number.isInteger(code) && code >= 0 && code <= 255 ? code : 1
    emit(exitCode ? "stderr" : "stdout", {
      event: "provider_process_exited",
      level: exitCode ? "error" : "info",
      exitCode,
      ...(signals.has(signal) ? { signal } : {}),
    })
    process.exitCode = exitCode
  })
}

module.exports = { createCollector }
if (require.main === module) run(process.argv[2], process.argv.slice(3))
