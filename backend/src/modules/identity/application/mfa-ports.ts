import type { MfaOverride, SecurityPolicy } from "@cardapio/contracts"
import type { Actor } from "../domain/identity.js"
import type { SessionInput } from "./ports.js"
export interface MfaCredential {
  secret: string
  enabledAt: Date | null
  pendingSessionId: string | null
  pendingExpiresAt: Date | null
  lastCounter: bigint
  recoveryHashes: string[]
}
export interface MfaCryptography {
  setup(
    userId: string,
    label: string,
  ): Promise<{ secret: string; encrypted: string; qr: string }>
  counter(
    userId: string,
    encrypted: string,
    code: string,
    now: Date,
  ): Promise<number | null>
  recoveryCodes(): string[]
}
export interface MfaRepository {
  credential(userId: string): Promise<MfaCredential | null>
  setup(
    actor: Actor,
    passwordHash: string,
    secret: string,
    expires: Date,
    now: Date,
  ): Promise<void>
  complete(
    actor: Actor,
    expectedSecret: string,
    proof: { counter?: number; recoveryHash?: string },
    recoveryHashes: string[],
    session: SessionInput,
    now: Date,
  ): Promise<void>
  disable(
    actor: Actor,
    expectedSecret: string,
    proof: { counter?: number; recoveryHash?: string },
    passwordHash: string,
    now: Date,
  ): Promise<void>
  policy(tenantId: string): Promise<SecurityPolicy>
  updatePolicy(
    actor: Actor,
    tenantId: string,
    passwordHash: string,
    change: { required: boolean } | { userId: string; override: MfaOverride },
    now: Date,
  ): Promise<void>
}
