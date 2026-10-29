import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { delimiter } from "node:path"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(
  new URL(
    `../.railway/node_modules/@railway/cli/bin/railway${process.platform === "win32" ? ".exe" : ""}`,
    import.meta.url,
  ),
)
if (!existsSync(cli)) {
  console.error(
    "Instale o CLI fixado com npm ci --prefix .railway. Se os scripts de instalação estiverem bloqueados, autorize o postinstall do pacote oficial @railway/cli.",
  )
  process.exitCode = 1
} else {
  const result = spawnSync(cli, process.argv.slice(2), {
    stdio: "inherit",
    env: {
      ...process.env,
      _: cli,
      PATH:
        fileURLToPath(new URL("../.railway/node_modules/.bin/", import.meta.url)) +
        delimiter +
        process.env.PATH,
    },
  })
  if (result.error) console.error("Não foi possível iniciar o CLI Railway instalado.")
  process.exitCode = result.status ?? 1
}
