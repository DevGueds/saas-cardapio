import type { Result } from "./result"
export interface DeviceLocation {
  unsupported(): string | null
  locate(): Promise<Result<{ latitude: number; longitude: number; accuracy: number }>>
}
