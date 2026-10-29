import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises"
import { randomBytes, createECDH } from "node:crypto"
import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"

function detectRepository() {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      windowsHide: true,
    }).trim()
    const url = new URL(remote.replace(/^git@github\.com:/, "https://github.com/"))
    const repository = url.pathname.replace(/^\//, "").replace(/(?:\.git)?\/?$/, "")
    if (
      url.hostname !== "github.com" ||
      !["https:", "ssh:"].includes(url.protocol) ||
      url.port ||
      url.search ||
      url.hash ||
      !/^[\w.-]+\/[\w.-]+$/.test(repository)
    )
      throw new Error()
    return repository
  } catch {
    throw new Error(
      "Não foi possível identificar um repositório GitHub pelo remote origin. Informe --repository dono/repositorio.",
    )
  }
}

const { values } = parseArgs({
  options: {
    environment: { type: "string", default: "production" },
    branch: { type: "string" },
    repository: { type: "string" },
    origin: { type: "string" },
    contact: { type: "string" },
    "close-signup": { type: "boolean", default: false },
  },
  allowPositionals: false,
})
if (!/^[a-zA-Z0-9_-]{1,60}$/.test(values.environment))
  throw new Error("Nome do ambiente inválido.")
const folder = new URL("./local/", import.meta.url),
  file = new URL(`${values.environment}.json`, folder)
await mkdir(folder, { recursive: true, mode: 0o700 })
let current
try {
  current = JSON.parse(await readFile(file, "utf8"))
} catch (error) {
  if (error.code !== "ENOENT")
    throw new Error(
      "O arquivo local existente está inválido. Recupere-o antes de continuar; nenhum segredo foi substituído.",
    )
}
if (!current) {
  const ec = createECDH("prime256v1")
  ec.generateKeys()
  current = {
    repository: values.repository ?? detectRepository(),
    branch: "main",
    publicOrigin: "",
    contact: "mailto:admin@localhost.invalid",
    signupEnabled: true,
    secrets: Object.fromEntries(
      [
        "postgres",
        "app",
        "migrator",
        "redis",
        "evolutionDatabase",
        "evolutionApi",
        "session",
      ].map((key) => [key, randomBytes(32).toString("hex")]),
    ),
  }
  current.secrets.vapidPublic = ec.getPublicKey().toString("base64url")
  current.secrets.vapidPrivate = ec.getPrivateKey().toString("base64url")
}
for (const [flag, key] of [
  ["branch", "branch"],
  ["repository", "repository"],
  ["origin", "publicOrigin"],
  ["contact", "contact"],
])
  if (values[flag] !== undefined) current[key] = values[flag]
if (values["close-signup"]) current.signupEnabled = false
const { validateParameters } = await import("./parameters.ts")
validateParameters(current)
const temporary = new URL(
  `${values.environment}.${randomBytes(8).toString("hex")}.tmp`,
  folder,
)
try {
  await writeFile(temporary, JSON.stringify(current, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  })
  await rename(temporary, file)
} finally {
  await unlink(temporary).catch(() => undefined)
}
console.log(
  `Configuração privada de ${values.environment} preparada em .railway/local/${values.environment}.json. Segredos existentes preservados. Guarde backup seguro desse arquivo.`,
)
console.log(
  `Fonte GitHub: ${current.repository} (branch ${current.branch}). Esta preparação não cria serviços na Railway; o próximo passo é pnpm railway:plan.`,
)
