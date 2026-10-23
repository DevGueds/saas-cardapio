import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { resolve, join } from "node:path"

// Official release archives, verified against the publisher's SHA-256 checksums.
const version = "8.30.1"
const platforms = {
  win32: {
    file: `gitleaks_${version}_windows_x64.zip`,
    hash: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
    executable: "gitleaks.exe",
  },
  linux: {
    file: `gitleaks_${version}_linux_x64.tar.gz`,
    hash: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
    executable: "gitleaks",
  },
}
async function check() {
  const target = platforms[process.platform]
  if (!target || process.arch !== "x64")
    throw new Error(
      "Use Gitleaks 8.30.1 no seu sistema para verificar o histórico e o diff, com --redact=100.",
    )
  const directory = resolve(".cache", "security-tools", `gitleaks-${version}`),
    archive = join(directory, target.file)
  await mkdir(directory, { recursive: true })
  let bytes
  try {
    bytes = await readFile(archive)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  if (!bytes) {
    const response = await fetch(
      `https://github.com/gitleaks/gitleaks/releases/download/v${version}/${target.file}`,
      { signal: AbortSignal.timeout(90000) },
    )
    if (!response.ok) throw new Error("Falha ao baixar Gitleaks.")
    bytes = Buffer.from(await response.arrayBuffer())
    if (createHash("sha256").update(bytes).digest("hex") !== target.hash)
      throw new Error("Checksum Gitleaks inválido.")
    await writeFile(archive, bytes)
  }
  if (createHash("sha256").update(bytes).digest("hex") !== target.hash)
    throw new Error("Checksum Gitleaks inválido.")
  if (process.platform === "win32") {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`
    const command = `$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(directory)} -Force`
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-OutputFormat",
        "Text",
        "-EncodedCommand",
        Buffer.from(command, "utf16le").toString("base64"),
      ],
      { stdio: "inherit", windowsHide: true },
    )
  } else execFileSync("tar", ["-xzf", archive, "-C", directory], { stdio: "inherit" })
  const executable = join(directory, target.executable)
  for (const flags of [
    ["--log-opts=--all"],
    ["--pre-commit"],
    ["--pre-commit", "--staged"],
  ]) {
    execFileSync(
      executable,
      [
        "git",
        ".",
        "--redact=100",
        "--no-banner",
        "--no-color",
        "--timeout=120",
        ...flags,
      ],
      { stdio: "inherit", windowsHide: true },
    )
  }
}
check().catch(() => {
  console.error(
    "A verificação de segredos falhou. Confira o resultado acima; nenhum segredo deve ser publicado.",
  )
  process.exitCode = 1
})
