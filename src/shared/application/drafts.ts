export interface DraftEntry {
  value: unknown
  updatedAt: number
  expiresAt: number
  issue: string | null
}
export interface DraftStorage {
  length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export interface DraftManager {
  snapshot(key: string): DraftEntry | undefined
  subscribe(listener: () => void): () => void
  set(key: string, value: unknown, ttlMs?: number): boolean
  clear(key: string): void
  clearPrefix(prefix: string): void
  receive(key: string | null, newValue: string | null): void
}
export const DRAFT_PREFIX = "cardapio:draft:v1:"
export const DRAFT_TTL = 24 * 60 * 60 * 1000
