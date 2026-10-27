import { spawn } from "node:child_process"
import { mkdir, readFile, rename } from "node:fs/promises"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { parseEnv } from "node:util"
import { randomUUID } from "node:crypto"

try {
  const env = parseEnv(await readFile("backend/.env", "utf8"))
  const source = new URL(env.LEGACY_DATABASE_URL)
  if (
    source.protocol !== "mysql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) ||
    Number(source.port || 3306) !== 3307 ||
    !/^\/[a-zA-Z0-9_]+$/.test(source.pathname)
  )
    throw new Error("legacy_source_invalid")
  await mkdir(".cache/migrations", { recursive: true })
  const destination = `.cache/migrations/mysql-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.sql`
  const child = spawn(
    "docker",
    [
      "compose",
      "--env-file",
      "backend/.env",
      "-f",
      "compose.mysql-legacy.yaml",
      "exec",
      "-T",
      "mysql",
      "sh",
      "-c",
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --no-tablespaces --databases "$1"',
      "--",
      source.pathname.slice(1),
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )
  child.stderr.on("data", () => {})
  const completed = new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("backup_failed")),
    )
  })
  await Promise.all([
    pipeline(
      child.stdout,
      createWriteStream(destination + ".partial", { flags: "wx", mode: 0o600 }),
    ),
    completed,
  ])
  await rename(destination + ".partial", destination)
  console.log(
    `Backup concluído: ${destination}. Guarde uma cópia segura antes da transferência.`,
  )
} catch {
  console.error(
    "Backup não confirmado. Confira a origem legada e o serviço MySQL antes de importar; arquivos parciais não servem como backup.",
  )
  process.exitCode = 1
}
