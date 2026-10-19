import type { ErrorCode } from "@cardapio/domain/failure"

export interface IdGenerator {
  next(): string
}
export interface Clock {
  now(): Date
}
export interface SecretTokens {
  create(): string
  hash(value: string): string
  csrf(token: string): string
  equalHash(value: string, hash: string): boolean
  fingerprint(value: string): string
}
export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(hash: string, password: string): Promise<boolean>
  dummyHash: string
}
export interface DiagnosticLogger {
  record(event: {
    module: string
    diagnosticId: string
    operation: string
    code: ErrorCode
    timestamp: string
    cause: string
    errorType?: string
    frames?: string[]
  }): void
}
export interface RequestLimiter {
  consume(key: string, maximum: number, windowSeconds: number): Promise<void>
}
