import { spawn } from "node:child_process"

const packageManager = process.env.npm_execpath
if (!packageManager) throw new Error("Inicie com pnpm dev:full.")
const run = (script) =>
  spawn(process.execPath, [packageManager, script], {
    stdio: "inherit",
    detached: process.platform !== "win32",
  })
const prepared = run("build:shared")
const prepareCode = await new Promise((resolve, reject) => {
  prepared.once("error", reject)
  prepared.once("exit", resolve)
})
if (prepareCode !== 0) process.exit(prepareCode ?? 1)

const children = ["api:dev", "dev:api"].map(run)
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    if (process.platform === "win32") {
      // Stop only the process tree started by this launcher.
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {
        /* Already stopped. */
      }
    }
  }
}
children.forEach((child) => {
  child.once("error", () => stop(1))
  child.once("exit", (code) => stop(code ?? 1))
})
process.on("SIGINT", () => stop())
process.on("SIGTERM", () => stop())
