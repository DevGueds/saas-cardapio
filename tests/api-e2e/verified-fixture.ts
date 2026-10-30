import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
// Only existing, unrelated browser suites use this fixture. The dedicated email
// suite exercises delivery and confirmation through HTTP instead.
export async function verifyFixtureEmail(email: string) {
  const require = createRequire(new URL("../../backend/package.json", import.meta.url))
  const local = require("dotenv").parse(
    readFileSync(new URL("../../backend/.env", import.meta.url)),
  )
  const target = process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL
  if (
    !target ||
    !new URL(target).pathname.endsWith("_test") ||
    !email.endsWith("@browser.example.test")
  )
    throw new Error(
      "Email fixtures require an isolated _test database and a dummy browser email.",
    )
  const client = new (require("pg").Client)({ connectionString: target })
  try {
    await client.connect()
    await client.query('UPDATE "User" SET "emailVerifiedAt" = now() WHERE email = $1', [
      email,
    ])
  } finally {
    await client.end()
  }
}
