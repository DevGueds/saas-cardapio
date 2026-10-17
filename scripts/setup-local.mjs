import { randomBytes } from "node:crypto"
import { writeFile, access, readFile, appendFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
const file = fileURLToPath(new URL("../backend/.env", import.meta.url))
try {
  await access(file)
  console.log("backend/.env já existe e foi preservado.")
} catch {
  const appPassword = randomBytes(24).toString("hex"),
    rootPassword = randomBytes(24).toString("hex")
  const value = [
    "NODE_ENV=development",
    "HOST=127.0.0.1",
    "PORT=3001",
    "DATABASE_TLS=false",
    `DATABASE_URL=mysql://cardapio:${appPassword}@127.0.0.1:3307/cardapio`,
    `MIGRATION_DATABASE_URL=mysql://root:${rootPassword}@127.0.0.1:3307/cardapio`,
    `TEST_DATABASE_URL=mysql://cardapio:${appPassword}@127.0.0.1:3307/cardapio_test`,
    `TEST_MIGRATION_DATABASE_URL=mysql://root:${rootPassword}@127.0.0.1:3307/cardapio_test`,
    `MYSQL_PASSWORD=${appPassword}`,
    `MYSQL_ROOT_PASSWORD=${rootPassword}`,
    `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
    "SESSION_TTL_SECONDS=28800",
    "CORS_ORIGINS=http://localhost:8443,http://127.0.0.1:8443,http://localhost:4176,http://127.0.0.1:4176",
    "SIGNUP_ENABLED=true",
    "DOCS_ENABLED=true",
    "",
  ].join("\n")
  await writeFile(file, value, { encoding: "utf8", flag: "wx", mode: 0o600 })
  console.log("backend/.env criado com segredos locais aleatórios. Não o envie ao Git.")
}

const existing = await readFile(file, "utf8")
const redisPassword =
  existing.match(/^REDIS_PASSWORD=(.+)$/m)?.[1] ?? randomBytes(24).toString("hex")
const additions = []
if (!/^REDIS_PASSWORD=/m.test(existing)) additions.push(`REDIS_PASSWORD=${redisPassword}`)
if (!/^REDIS_URL=/m.test(existing))
  additions.push(`REDIS_URL=redis://:${redisPassword}@127.0.0.1:6380/0`)
if (additions.length) {
  await appendFile(file, "\n" + additions.join("\n") + "\n", "utf8")
  console.log("Configuração do Redis adicionada; valores existentes preservados.")
}
