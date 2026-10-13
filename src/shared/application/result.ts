import type { ErrorCode } from "../domain/failure"

export type AppError = Readonly<{
  code: ErrorCode

  message: string

  fields: Readonly<Record<string, string>>

  diagnosticId: string
}>

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
