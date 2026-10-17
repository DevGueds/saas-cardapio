import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const failures = []

function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.name === "generated"
        ? []
        : entry.isDirectory()
          ? files(path.join(dir, entry.name))
          : entry.name.endsWith(".ts")
            ? [path.join(dir, entry.name)]
            : [],
    )
}

for (const file of [...files("src"), ...files("../packages/domain/src")]) {
  const normalized = file.replaceAll("\\", "/")
  const core = normalized.includes("/domain/") || normalized.includes("/application/")
  const pure = normalized.includes("packages/domain/")
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  )

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text
      if (normalized.startsWith("src/shared/") && /modules|app\//.test(name))
        failures.push(
          `${file}: shared não pode depender de módulos ou composição (${name})`,
        )
      if (pure && !name.startsWith("."))
        failures.push(`${file}: domínio compartilhado não pode importar ${name}`)
      if (
        core &&
        (/infrastructure|presentation|generated|app\//.test(name) ||
          /^(?:@nestjs|@prisma|fastify|node:|react|pg|@supabase)/.test(name))
      )
        failures.push(`${file}: núcleo depende do adaptador ${name}`)
      if (normalized.includes("/domain/") && /\/application\//.test(name))
        failures.push(`${file}: domínio depende da aplicação`)
    }
    if (
      core &&
      ts.isIdentifier(node) &&
      ["process", "fetch", "window", "localStorage"].includes(node.text)
    )
      failures.push(`${file}: dependência de ambiente no núcleo: ${node.text}`)
    ts.forEachChild(node, visit)
  }
  visit(ast)
}

if (failures.length) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else console.log("API: domínio e aplicação independentes de adaptadores.")