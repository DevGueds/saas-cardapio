import autocannon from "autocannon"
import { mkdir, writeFile } from "node:fs/promises"
import { cpus, totalmem } from "node:os"
const target = new URL(
  process.env.BENCHMARK_URL ??
    "http://127.0.0.1:8080/api/v1/public/restaurants/benchmark-local/menu",
)
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
  throw new Error("O benchmark só aceita servidor local")
const connections = Number(process.env.BENCHMARK_CONNECTIONS ?? 1000),
  duration = Number(process.env.BENCHMARK_SECONDS ?? 15)
if (
  !Number.isInteger(connections) ||
  connections < 1 ||
  connections > 5000 ||
  !Number.isInteger(duration) ||
  duration < 5 ||
  duration > 60
)
  throw new Error("Carga inválida: 1–5000 conexões, 5–60 segundos")
const warm = await fetch(target)
if (!warm.ok) throw new Error(`Fixture indisponível: HTTP ${warm.status}`)
const sample = await warm.text()
if (!JSON.parse(sample).ok) throw new Error("Contrato inválido na fixture")
const result = await new Promise((resolve, reject) =>
  autocannon(
    {
      url: target.href,
      connections,
      duration,
      pipelining: 1,
      timeout: 10,
      headers: { "Accept-Encoding": "gzip" },
    },
    (error, result) => (error ? reject(error) : resolve(result)),
  ),
)
const report = {
  at: new Date().toISOString(),
  node: process.version,
  host: { cpus: cpus().length, memoryGiB: Math.round(totalmem() / 1024 ** 3) },
  scenario:
    "Public menu, Redis cache, local Caddy and two API replicas; no images or writes",
  connections,
  duration: result.duration,
  payloadBytes: Buffer.byteLength(sample),
  requests: result.requests.total,
  requestsPerSecond: result.requests.average,
  latencyMs: {
    p50: result.latency.p50,
    p97_5: result.latency.p97_5,
    p99: result.latency.p99,
    max: result.latency.max,
  },
  status: result.statusCodeStats,
  errors: result.errors,
  timeouts: result.timeouts,
  non2xx: result.non2xx,
}
await mkdir(".cache", { recursive: true })
await writeFile(".cache/benchmark.json", JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(report, null, 2))
if (report.errors || report.non2xx) process.exitCode = 1
