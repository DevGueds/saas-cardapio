import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/docker-e2e",
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: process.env.DOCKER_E2E_ORIGIN ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [{ name: "chromium-docker", use: { ...devices["Desktop Chrome"] } }],
})
