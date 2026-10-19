import type { ErrorCode } from "../domain/failure"

export interface IdGenerator {
  next(): string
}

export interface ContentFingerprint {
  digest(value: string): Promise<string>
}

export interface AccessPolicy {
  assertRead(): void
  assertAdmin(): void
}

export interface DiagnosticEvent {
  diagnosticId: string

  timestamp: string

  module: string

  operation: string

  code: ErrorCode

  cause: string

  invalidFields: readonly string[]
}

export interface DiagnosticLogger {
  record(event: DiagnosticEvent): void
}

export interface ExclusiveLock {
  run<T>(name: string, action: () => Promise<T>): Promise<T>
}
