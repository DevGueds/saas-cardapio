export const errorCodes = [
  "VALIDATION",
  "NOT_FOUND",
  "ACCESS_DENIED",
  "CONFIGURATION",
  "CONFLICT",
  "STORAGE_UNAVAILABLE",
  "STORAGE_QUOTA",
  "CORRUPT_DATA",
  "CAPABILITY_UNAVAILABLE",
  "UNEXPECTED",
  "UNAUTHENTICATED",
  "MFA_REQUIRED",
  "CSRF_INVALID",
  "RATE_LIMITED",
  "ACCOUNT_UNAVAILABLE",
] as const
export type ErrorCode = (typeof errorCodes)[number]

export class Failure extends Error {
  constructor(
    public readonly code: ErrorCode,

    message: string,

    public readonly fields: Readonly<Record<string, string>> = {},

    public readonly technicalCause?: string,
  ) {
    super(message)

    this.name = "Failure"
  }
}

export function requireValid(
  condition: unknown,
  message: string,
  field?: string,
): asserts condition {
  if (!condition)
    throw new Failure("VALIDATION", message, field ? { [field]: message } : {})
}
