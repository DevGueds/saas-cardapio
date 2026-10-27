import { createHash } from "node:crypto"

export function legacyMigrationChecksums(sql: Uint8Array): Set<string> {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(sql)
  const lf = text.replaceAll("\r\n", "\n")
  return new Set(
    [text, lf, lf.replaceAll("\n", "\r\n")].map((version) =>
      createHash("sha256").update(version).digest("hex"),
    ),
  )
}

export type Column = { name: string; type: string; nullable: boolean; uuid: boolean }
export type Table = { name: string; columns: Column[]; keys: string[] }

/** Read only the scalar subset we support; fail on mapping/schema changes. */
export function importTables(schema: string): Table[] {
  if (/@{1,2}map\(/.test(schema)) throw new Error("import_schema_mapping_unsupported")
  const scalars = new Set(["String", "Boolean", "Int", "BigInt", "Json", "DateTime"])
  for (const match of schema.matchAll(/^enum (\w+) \{/gm)) scalars.add(match[1]!)
  const models = [...schema.matchAll(/^model (\w+) \{([^}]+)\}/gm)]
  const modelNames = new Set(models.map((match) => match[1]!))
  const pending = models.map((match) => {
    const columns: Column[] = [],
      keys: string[] = [],
      parents: string[] = []
    for (const line of match[2]!.split("\n")) {
      const field = line.match(/^\s*(\w+)\s+(\w+)(\??)(\[\])?\s*(.*)$/)
      if (!field) continue
      const [, name, type, nullable, list, attributes] = field
      if (!scalars.has(type!)) {
        if (!modelNames.has(type!)) throw new Error("import_scalar_type_unsupported")
        if (attributes?.includes("@relation(")) parents.push(type!)
        continue
      }
      if (list) throw new Error("import_scalar_list_unsupported")
      columns.push({
        name: name!,
        type: type!,
        nullable: nullable === "?",
        uuid: !!attributes?.includes("@db.Uuid"),
      })
      if (attributes?.includes("@id")) keys.push(name!)
    }
    const compound = match[2]!.match(/@@id\(\[([\w,\s]+)\]\)/)
    if (compound) keys.push(...compound[1]!.split(",").map((key) => key.trim()))
    if (!keys.length || keys.some((key) => !columns.some((c) => c.name === key)))
      throw new Error("import_primary_key_unsupported")
    return { table: { name: match[1]!, columns, keys }, parents }
  })
  const ordered: Table[] = []
  while (pending.length) {
    const ready = pending.findIndex((m) =>
      m.parents.every((p) => ordered.some((t) => t.name === p)),
    )
    if (ready < 0) throw new Error("import_schema_cycle")
    ordered.push(pending.splice(ready, 1)[0]!.table)
  }
  return ordered
}

export function identifier(value: string, dialect: "mysql" | "postgres") {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) throw new Error("import_identifier_invalid")
  const quote = dialect === "mysql" ? "`" : '"'
  return `${quote}${value}${quote}`
}
