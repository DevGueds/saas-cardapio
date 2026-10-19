import { networkInterfaces } from "node:os"
import { readFile, writeFile, rename, unlink } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { configureLanEnvironment, isPrivateIPv4 } from "./local-network.mjs"

const interfaces = networkInterfaces()
const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== "--host") {
  console.error("Uso: pnpm setup:lan --host <IPv4 deste computador>")
  for (const [name, entries] of Object.entries(interfaces))
    for (const entry of entries ?? [])
      if (!entry.internal && isPrivateIPv4(entry.address))
        console.error(`${name}: ${entry.address}`)
  process.exitCode = 1
} else {
  const file = fileURLToPath(new URL("../backend/.env", import.meta.url))
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    const current = await readFile(file, "utf8")
    const updated = configureLanEnvironment(current, args[1], interfaces)
    if (updated !== current) {
      await writeFile(temporary, updated, { encoding: "utf8", flag: "wx", mode: 0o600 })
      await rename(temporary, file)
    }
    console.log(
      `Rede configurada: http://${args[1]}:8080. Execute pnpm docker:up para aplicar.`,
    )
    console.log(
      "Segredos preservados; MySQL, Redis e APIs continuam sem exposição à rede local.",
    )
  } catch (error) {
    console.error(
      error.code === "ENOENT"
        ? "Execute pnpm setup:local antes de configurar a rede."
        : error.message,
    )
    process.exitCode = 1
  } finally {
    await unlink(temporary).catch(() => {})
  }
}
