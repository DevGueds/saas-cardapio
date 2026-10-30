import { readdir } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli")
const suites = (await readdir("tests/api-e2e"))
  .filter((name) => name.endsWith(".spec.ts"))
  .sort()
if (!suites.length) throw new Error("Nenhum cenário de navegador da API encontrado.")

// Every feature suite starts its own server and random test SESSION_SECRET.
// Real Redis rate limits remain enabled, without sharing signup quotas across suites.
for (const suite of suites) {
  console.log(`API browser: ${suite} (servidor isolado)`)
  const result = spawnSync(
    process.execPath,
    [cli, "test", "--config", "playwright.api.config.ts", suite],
    { stdio: "inherit", windowsHide: true, env: { ...process.env, EMAIL_SEND_ENABLED: ["email-security.spec.ts", "full-flow.spec.ts", "privacy.spec.ts"].includes(suite) ? "true" : "false" } },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
