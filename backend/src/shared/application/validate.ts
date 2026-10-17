import { validationMessage } from "@cardapio/contracts"
import type { z } from "zod"
import { Failure } from "@cardapio/domain/failure"

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input)
  if (parsed.success) return parsed.data
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path.map(String).join(".") || "form"
    fields[field] ??= validationMessage(issue)
  }
  throw new Failure("VALIDATION", "Revise os campos informados.", fields)
}
