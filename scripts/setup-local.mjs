import { configurePostgresEnvironment } from "./postgres-environment.mjs"
import { randomBytes, createECDH } from "node:crypto"
import { writeFile, access, readFile, appendFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
const file = fileURLToPath(new URL("../backend/.env", import.meta.url))
try {
  await access(file)
  console.log("backend/.env já existe e foi preservado.")
} catch {
  const value = [
    "NODE_ENV=development",
    "HOST=127.0.0.1",
    "PORT=3001",
    "DATABASE_TLS=false",
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

const original = await readFile(file, "utf8")
const configured = configurePostgresEnvironment(original, () =>
  randomBytes(24).toString("hex"),
)
if (configured.upgraded) {
  const backup = `${file}.mysql-backup`
  try {
    await writeFile(backup, original, { encoding: "utf8", flag: "wx", mode: 0o600 })
  } catch (error) {
    if (error.code !== "EEXIST") throw error
  }
  console.log(
    "Configuração PostgreSQL preparada. Backup MySQL e segredos existentes preservados; dados ainda exigem importação explícita.",
  )
}
if (configured.contents !== original)
  await writeFile(file, configured.contents, { encoding: "utf8", mode: 0o600 })
const existing = configured.contents
const redisPassword =
  existing.match(/^REDIS_PASSWORD=(.+)$/m)?.[1] ?? randomBytes(24).toString("hex")
const additions = []
if (!/^VAPID_PUBLIC_KEY=/m.test(existing) && !/^VAPID_PRIVATE_KEY=/m.test(existing)) {
  const keys = createECDH("prime256v1")
  keys.generateKeys()
  additions.push(
    `VAPID_PUBLIC_KEY=${keys.getPublicKey().toString("base64url")}`,
    `VAPID_PRIVATE_KEY=${keys.getPrivateKey().toString("base64url")}`,
  )
}
for (const [key, value] of Object.entries({
  LOG_LEVEL: "info",
  LOG_DIRECTORY: "logs",
  LOG_INSTANCE: "api",
  VAPID_SUBJECT: "mailto:admin@localhost.invalid",
  EVOLUTION_URL: "http://127.0.0.1:8081",
  EVOLUTION_API_KEY: randomBytes(32).toString("hex"),
  EVOLUTION_DATABASE_PASSWORD: randomBytes(24).toString("hex"),
  DOCKER_CORS_ORIGINS: ["http://localhost:8080", "http://127.0.0.1:8080"].join(","),
  WEB_BIND_ADDRESS: "127.0.0.1",
}))
  if (!new RegExp(`^${key}=`, "m").test(existing)) additions.push(`${key}=${value}`)
if (!/^REDIS_PASSWORD=/m.test(existing)) additions.push(`REDIS_PASSWORD=${redisPassword}`)
if (!/^REDIS_URL=/m.test(existing))
  additions.push(`REDIS_URL=redis://:${redisPassword}@127.0.0.1:6380/0`)
if (additions.length) {
  await appendFile(file, "\n" + additions.join("\n") + "\n", "utf8")
  console.log("Configuração local complementada; valores existentes preservados.")
}
