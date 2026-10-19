import fs from "node:fs"

import path from "node:path"

import ts from "typescript"

const root = path.resolve("src")

const failures = []

function files(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(folder, entry.name)

    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : []
  })
}

function layer(file) {
  return file.match(/\/(domain|application|infrastructure|presentation)\//)?.[1]
}

for (const file of files(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/")

  const originLayer = layer(`/${relative}`)

  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  )

  function inspect(node) {
    if (
      originLayer === "presentation" &&
      ts.isIdentifier(node) &&
      node.text === "crypto"
    ) {
      failures.push(
        `${relative}: injete o gerador de identificadores; recursos criptográficos pertencem à infraestrutura`,
      )
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ["input", "textarea", "select", "form"].includes(node.tagName.getText(ast)) &&
      !relative.startsWith("shared/presentation/form-validation/") &&
      !(
        relative === "shared/presentation/ImagePicker.tsx" &&
        node.tagName.getText(ast) === "input"
      )
    ) {
      failures.push(`${relative}: use os controles compartilhados com validação Zod`)
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier

      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text

        const target = name.startsWith(".")
          ? path
              .relative(root, path.resolve(path.dirname(file), name))
              .replaceAll("\\", "/")
          : name

        const targetLayer = layer(`/${target}`)

        const reason =
          originLayer === "domain" &&
          ((targetLayer && targetLayer !== "domain") ||
            (!name.startsWith(".") && !name.startsWith("@cardapio/domain/")))
            ? "Domínio só pode depender de domínio local"
            : originLayer === "application" &&
                (targetLayer === "presentation" ||
                  targetLayer === "infrastructure" ||
                  /^(react|react-router)/.test(name))
              ? "Aplicação não pode depender de adaptadores"
              : originLayer === "presentation" && targetLayer === "infrastructure"
                ? "Apresentação deve acessar casos de uso"
                : relative.startsWith("shared/") && /^(app|modules)\//.test(target)
                  ? "Shared não pode depender dos módulos"
                  : null

        if (reason) failures.push(`${relative}: ${reason} (${name})`)
      }
    }

    if (
      (originLayer === "domain" || originLayer === "application") &&
      ts.isIdentifier(node) &&
      [
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "navigator",
        "fetch",
        "FileReader",
      ].includes(node.text)
    ) {
      // Ignore property keys and type declarations; global browser access is forbidden in the core.

      if (
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
        !(ts.isParameter(node.parent) && node.parent.name === node) &&
        !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)
      ) {
        failures.push(`${relative}: dependência de navegador no núcleo (${node.text})`)
      }
    }

    ts.forEachChild(node, inspect)
  }

  inspect(ast)
}

if (failures.length) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else console.log("Arquitetura: dependências entre camadas válidas.")
