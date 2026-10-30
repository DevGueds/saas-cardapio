export interface EmailChallenge {
  userId: string
  codeHash: string
  expiresAt: Date
  retryAt: Date
}
export interface EmailVerificationRepository {
  pending(userId: string): Promise<{ retryAt: Date } | null>
  reserve(challenge: EmailChallenge, now: Date): Promise<void>
  cancel(userId: string, codeHash: string): Promise<void>
  confirm(userId: string, codeHash: string, now: Date): Promise<boolean>
}
export interface VerificationMail {
  send(email: string, code: string): Promise<void>
}
export interface VerificationCodes {
  create(): string
  hash(userId: string, code: string): string
}
export interface BotProtection {
  verify(
    token: string | undefined,
    ip: string,
    action: "login" | "register",
  ): Promise<void>
}
