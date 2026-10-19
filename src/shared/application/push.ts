import type { Result } from "./result"
export interface DevicePush {
  unsupported(): string | null
  subscribe(
    publicKey: string,
  ): Promise<Result<{ endpoint: string; keys: { p256dh: string; auth: string } }>>
  current(): Promise<Result<{ endpoint: string } | null>>
}
