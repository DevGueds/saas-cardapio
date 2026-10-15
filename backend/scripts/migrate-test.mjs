import "dotenv/config"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const target = process.env.TEST_MIGRATION_DATABASE_URL
if (!target || !new URL(target).pathname.endsWith("_test"))
  throw new Error("Configure um banco exclusivo com sufixo _test.")
const result = spawnSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
  { env: { ...process.env, MIGRATION_DATABASE_URL: target }, stdio: "inherit" },
)
process.exitCode = result.status ?? 1
