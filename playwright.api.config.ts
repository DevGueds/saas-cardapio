import { defineConfig, devices } from "@playwright/test"
import { networkInterfaces } from "node:os"
import { isIP } from "node:net"

// A real non-loopback origin catches secure-context dependencies hidden by localhost.
const host =
  process.env.E2E_LAN_HOST ??
  Object.entries(networkInterfaces())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, entries]) => entries ?? [])
    .find((entry) => !entry.internal && entry.family === "IPv4")?.address
if (!host || isIP(host) !== 4 || host.startsWith("127."))
  throw new Error("Defina E2E_LAN_HOST com um IPv4 local diferente de loopback.")
const origin = `http://${host}:4176`

export default defineConfig({
  testDir: "./tests/api-e2e",
  outputDir: "./test-results/api",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  // Real API requests have a 15 s deadline, and cold Vite lazy routes may compile
  // while the assertion is waiting. Keep the check bounded without fixed sleeps.
  expect: { timeout: 15000 },
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [{ name: "chromium-api-http-lan", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @cardapio/api exec node scripts/serve-test.mjs",
      url: "http://127.0.0.1:3002/api/v1/health/ready",
      reuseExistingServer: false,
      env: { TEST_BROWSER_ORIGIN: origin },
      timeout: 120000,
    },
    {
      command: "pnpm dev:api --host 0.0.0.0 --port 4176",
      url: "http://127.0.0.1:4176",
      env: { VITE_API_BASE_URL: "/api/v1", API_PROXY_TARGET: "http://127.0.0.1:3002" },
      reuseExistingServer: false,
    },
  ],
})
