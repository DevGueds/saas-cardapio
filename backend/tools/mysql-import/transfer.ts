import { createHash } from "node:crypto"
import type { Table } from "./schema.js"
import { canonical } from "./values.js"

export interface ImportSource {
  pages(table: Table): AsyncIterable<unknown[][]>
}
export interface ImportTarget {
  begin(tables: Table[]): Promise<void>
  insert(table: Table, rows: unknown[][]): Promise<void>
  pages(table: Table): AsyncIterable<unknown[][]>
  commit(): Promise<void>
  rollback(): Promise<void>
}
export type ImportSummary = { table: string; rows: number; checksum: string }[]

async function digest(table: Table, store: ImportSource) {
  const hash = createHash("sha256")
  let rows = 0
  for await (const page of store.pages(table))
    for (const row of page) {
      hash.update(canonical(row) + "\n")
      rows++
    }
  return { table: table.name, rows, checksum: hash.digest("hex") }
}

export async function verifyTransfer(
  tables: Table[],
  source: ImportSource,
  target: ImportSource,
): Promise<ImportSummary> {
  const summary: ImportSummary = []
  for (const table of tables) {
    const expected = await digest(table, source),
      actual = await digest(table, target)
    if (expected.rows !== actual.rows || expected.checksum !== actual.checksum)
      throw new Error("import_verification_failed")
    summary.push(expected)
  }
  return summary
}

export async function transfer(
  tables: Table[],
  source: ImportSource,
  target: ImportTarget,
): Promise<ImportSummary> {
  const summary: ImportSummary = []
  try {
    await target.begin(tables)
    for (const table of tables) {
      const expected = createHash("sha256")
      let rows = 0
      for await (const page of source.pages(table)) {
        for (const row of page) {
          expected.update(canonical(row) + "\n")
          rows++
        }
        await target.insert(table, page)
      }
      const actual = createHash("sha256")
      let copied = 0
      for await (const page of target.pages(table))
        for (const row of page) {
          actual.update(canonical(row) + "\n")
          copied++
        }
      const checksum = expected.digest("hex")
      if (copied !== rows || actual.digest("hex") !== checksum)
        throw new Error("import_verification_failed")
      summary.push({ table: table.name, rows, checksum })
    }
    await target.commit()
    return summary
  } catch (error) {
    await target.rollback().catch(() => {})
    throw error
  }
}
