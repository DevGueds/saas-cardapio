import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
const compose = [
  "compose",
  "--env-file",
  "backend/.env",
  "-f",
  "compose.yaml",
  "--profile",
  "app",
]
function docker(...args) {
  const result = spawnSync("docker", [...compose, ...args], {
    stdio: "inherit",
    windowsHide: true,
  })
  if (result.status !== 0) throw new Error("Docker service command failed")
}
const base = "http://127.0.0.1:8080/api/v1"
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function status(path) {
  try {
    return (await fetch(base + path, { signal: AbortSignal.timeout(8000) })).status
  } catch {
    return 0
  }
}
async function expectEventually(path, expected) {
  const deadline = Date.now() + 25000
  do {
    if ((await status(path)) === expected) return
    await pause(400)
  } while (Date.now() < deadline)
  throw new Error(`Expected HTTP ${expected} for ${path}`)
}
await expectEventually("/health/ready", 200)
try {
  docker("stop", "api-replica")
  for (let i = 0; i < 20; i++) assert.equal(await status("/configuration"), 200)
  console.log("Failover: 20 reads succeeded with one API stopped")
  docker("up", "-d", "--no-deps", "--wait", "api-replica")
  docker("stop", "redis")
  await expectEventually("/configuration", 503)
  await expectEventually("/health/ready", 503)
  console.log("Redis unavailable: application and readiness fail closed (503)")
  docker("up", "-d", "--no-deps", "--wait", "redis")
  await expectEventually("/health/ready", 200)
  docker("stop", "postgres")
  await expectEventually("/health/ready", 503)
  await expectEventually("/public/restaurants/postgres-resilience-check/menu", 503)
  console.log(
    "PostgreSQL unavailable: authoritative menu and readiness fail closed (503)",
  )
} finally {
  docker("up", "-d", "--no-deps", "--wait", "postgres")
  docker("up", "-d", "--no-deps", "--wait", "redis")
  docker("up", "-d", "--no-deps", "--wait", "api", "api-replica")
  await expectEventually("/health/ready", 200)
}
await expectEventually("/configuration", 200)
await expectEventually("/public/restaurants/postgres-resilience-check/menu", 404)
console.log("Dependencies restored; both APIs are available")
