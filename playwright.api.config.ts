import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/api-e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:4176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [{ name: "chromium-api", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @cardapio/api exec node scripts/serve-test.mjs",
      url: "http://127.0.0.1:3002/api/v1/health/ready",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "pnpm dev:api --host 127.0.0.1 --port 4176",
      url: "http://127.0.0.1:4176",
      env: { VITE_API_BASE_URL: "http://127.0.0.1:3002/api/v1" },
      reuseExistingServer: false,
    },
  ],
})
