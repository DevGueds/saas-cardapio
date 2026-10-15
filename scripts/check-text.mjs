import fs from "node:fs"

import path from "node:path"

import ts from "typescript"

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)

    return entry.isDirectory()
      ? ["generated", "dist", "node_modules", ".test-build"].includes(entry.name)
        ? []
        : files(file)
      : /\.(tsx?|css|json|md)$/.test(file)
        ? [file]
        : []
  })
}

const failures = []

const corrupted = /\p{L}\?+\p{L}|\uFFFD|Ã[\u0080-\u00bf]|â€/u

function withoutUrls(text) {
  return text.replace(/https?:\/\/\S+/g, "").replace(/\/[a-zA-Z][^\s]*\?[^\s]*/g, "")
}

for (const file of [
  ...files("src"),
  ...files("backend/src"),
  ...files("packages/domain/src"),
  ...files("packages/contracts/src"),
  ...files("docs"),
  "README.md",
  "AGENTS.md",
  ".figma/make/site.json",
]) {
  let source

  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file))
  } catch {
    failures.push(`${file}: UTF-8 inválido`)
    continue
  }

  if (/\.tsx?$/.test(file)) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

    function visit(node) {
      if (
        (ts.isStringLiteral(node) ||
          ts.isJsxText(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        corrupted.test(withoutUrls(node.text))
      ) {
        failures.push(
          `${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1}: texto possivelmente corrompido`,
        )
      }

      ts.forEachChild(node, visit)
    }

    visit(ast)
  } else if (corrupted.test(withoutUrls(source)))
    failures.push(`${file}: texto possivelmente corrompido`)
}

if (failures.length) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else console.log("Textos: UTF-8 e caracteres especiais válidos.")
