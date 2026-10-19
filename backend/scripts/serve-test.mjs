import "dotenv/config"
import { randomBytes } from "node:crypto"
import { createApplication } from "../dist/app/bootstrap.js"
import { loadConfig } from "../dist/app/config.js"
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error("Banco de testes obrigatório: sufixo _test.")
const server = await createApplication(
  loadConfig({
    ...process.env,
    DATABASE_URL: database,
    NODE_ENV: "test",
    PORT: "3002",
    HOST: "127.0.0.1",
    SIGNUP_ENABLED: "true",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    CORS_ORIGINS: process.env.TEST_BROWSER_ORIGIN ?? "http://127.0.0.1:4176",
  }),
)
await server.app.listen({ host: "127.0.0.1", port: 3002 })
