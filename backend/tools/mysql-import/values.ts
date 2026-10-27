import type { Column, Table } from "./schema.js"

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new Error("import_undefined_value")
  return encoded
}

function cell(column: Column, input: unknown, source: "mysql" | "postgres"): unknown {
  if (input === null) {
    if (!column.nullable) throw new Error("import_required_value_missing")
    return null
  }
  if (column.type === "Boolean") {
    if (![true, false, 0, 1].includes(input as boolean))
      throw new Error("import_boolean_invalid")
    return input === true || input === 1
  }
  if (column.type === "Int") {
    if (
      typeof input !== "number" ||
      !Number.isInteger(input) ||
      input < -2147483648 ||
      input > 2147483647
    )
      throw new Error("import_integer_invalid")
    return input
  }
  if (column.type === "BigInt") {
    if (typeof input !== "string" || !/^-?\d+$/.test(input))
      throw new Error("import_bigint_invalid")
    return BigInt(input).toString()
  }
  if (column.type === "Json") {
    if (typeof input !== "string") throw new Error("import_json_invalid")
    const parsed: unknown = JSON.parse(input)
    // Never silently round an imported integer or turn Infinity into JSON null.
    for (const token of input.matchAll(
      /"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    )) {
      if (!token[1]) continue
      const number = Number(token[1])
      if (
        !Number.isFinite(number) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number))
      )
        throw new Error("import_json_number_unsafe")
    }
    return canonical(parsed)
  }
  if (column.type === "DateTime") {
    if (source === "postgres" && input instanceof Date) return input.toISOString()
    if (
      typeof input !== "string" ||
      !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{1,3})?$/.test(input)
    )
      throw new Error("import_date_invalid")
    const date = new Date(input.replace(" ", "T") + "Z")
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 19) !== input.replace(" ", "T").slice(0, 19)
    )
      throw new Error("import_date_invalid")
    return date.toISOString()
  }
  if (typeof input !== "string" || input.includes("\0"))
    throw new Error("import_text_invalid")
  if (column.uuid) {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input))
      throw new Error("import_uuid_invalid")
    return input.toLowerCase()
  }
  return input
}

export function normalizedRow(
  table: Table,
  row: Record<string, unknown>,
  source: "mysql" | "postgres",
) {
  return table.columns.map((column) => cell(column, row[column.name], source))
}
