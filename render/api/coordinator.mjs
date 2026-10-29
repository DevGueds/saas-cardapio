import { createServer } from "node:http"

// No migrations at startup. The pre-deploy command must have succeeded first.
// A private HTTP process keeps this dedicated Render service alive (a successful
// one-shot background worker would otherwise restart indefinitely).
for (const key of Object.keys(process.env)) {
  if (/PASSWORD|SECRET|SEED|DATABASE_URL/.test(key)) delete process.env[key]
}
const port = Number(process.env.PORT || 10000)
if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(1)
const server = createServer((request, response) => {
  const ok = request.method === "GET" && request.url === "/healthz"
  response.writeHead(ok ? 200 : 404, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(JSON.stringify({ ok }))
})
server.requestTimeout = 5000
server.headersTimeout = 5000
server.keepAliveTimeout = 1000
server.maxHeadersCount = 30
server.on("error", () => {
  console.error(JSON.stringify({ event: "migration_service_failed" }))
  process.exit(1)
})
server.listen(port, "0.0.0.0")
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close()
    server.closeAllConnections()
  })
