import "dotenv/config"
import { loadConfig } from "./app/config.js"
import { createApplication } from "./app/bootstrap.js"
import { Operation } from "./shared/application/operation.js"
import { clock, diagnostics, ids } from "./shared/infrastructure/runtime.js"
let server: Awaited<ReturnType<typeof createApplication>> | undefined
try {
  const config = loadConfig(process.env)
  server = await createApplication(config)
  await server.app.listen({ host: config.host, port: config.port })
  process.stdout.write(`API pronta na porta ${config.port}.\n`)
} catch (cause) {
  await server?.close()
  new Operation(diagnostics, ids, clock).error("startup", cause)
  process.exitCode = 1
}
