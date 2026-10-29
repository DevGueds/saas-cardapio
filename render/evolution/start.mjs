import { spawn } from "node:child_process"
import { configureProviderEnvironment } from "../environment.mjs"
try {
  const env = configureProviderEnvironment(process.env)
  const child = spawn(
    process.execPath,
    [
      "/opt/cardapio/provider-log-gate.cjs",
      "/bin/bash",
      "-c",
      ". ./Docker/scripts/deploy_database.sh && npm run start:prod",
    ],
    { env, stdio: "inherit" },
  )
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal))
  child.once("error", () => {
    console.error(JSON.stringify({ event: "provider_start_failed" }))
    process.exitCode = 1
  })
  child.once("exit", (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1)
  })
} catch {
  console.error(JSON.stringify({ event: "provider_configuration_invalid" }))
  process.exitCode = 1
}
