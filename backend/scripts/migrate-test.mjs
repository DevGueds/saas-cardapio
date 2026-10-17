import "dotenv/config"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const target = process.env.TEST_MIGRATION_DATABASE_URL || process.env.TEST_DATABASE_URL

if (!target || (!new URL(target).pathname.endsWith("_test") && !target.includes("_test")))
  throw new Error("Configure um banco exclusivo com sufixo _test.")

const result = spawnSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "db", "push"],
  { env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target }, stdio: "inherit" },
)

process.exitCode = result.status ?? 1