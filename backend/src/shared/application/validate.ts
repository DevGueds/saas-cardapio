import type { z } from "zod"
import { Failure } from "@cardapio/domain/failure"

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input)
  if (parsed.success) return parsed.data
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path.map(String).join(".") || "form"
    fields[field] =
      field.includes("password") || field.includes("Password")
        ? "A senha deve ter entre 8 e 128 caracteres."
        : "Confira este campo. O valor está ausente, inválido ou excede o limite."
  }
  throw new Failure("VALIDATION", "Revise os campos informados.", fields)
}
