import { mkdirSync, lstatSync, readdirSync, copyFileSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
// Match the API Dockerfile COPY inputs. Explicitly omit credentials and caches.
const root = process.cwd(), destination = path.resolve(root, ".cache", `railway-api-${randomUUID()}`)
if (!destination.startsWith(path.resolve(root, ".cache") + path.sep)) throw new Error("Invalid staging path")
function copy(relative) {
  const source = path.join(root, relative), stat = lstatSync(source)
  if (stat.isSymbolicLink()) throw new Error("Symlink in deployment source")
  if (stat.isDirectory()) {
    mkdirSync(path.join(destination, relative), { recursive: true })
    for (const entry of readdirSync(source)) if (!["node_modules", "dist", "generated", ".test-build", "logs", "test"].includes(entry) && !entry.startsWith(".env")) copy(path.join(relative, entry))
  } else if (stat.isFile()) { mkdirSync(path.dirname(path.join(destination, relative)), { recursive: true }); copyFileSync(source, path.join(destination, relative)) }
  else throw new Error("Unsupported deployment source")
}
for (const relative of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".pnpmfile.cjs", ".dockerignore", "backend", "packages", "railway/api"]) copy(relative)
if (process.argv.includes("--web")) {
  for (const relative of ["src", "public", "docs", "scripts", "railway/web", ".figma/make/site.json", "README.md", "AGENTS.md", "index.html", "vite.config.ts", ...readdirSync(root).filter((name) => /^tsconfig.*\.json$/.test(name))]) copy(relative)
}
console.log(path.relative(root, destination))
