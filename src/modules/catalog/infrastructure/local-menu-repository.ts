import type { ExclusiveLock } from "../../../shared/application/ports"

import { Failure, requireValid } from "../../../shared/domain/failure"

import { identifier } from "../../../shared/domain/validation"

import { parseMenuDocument, type MenuDocument } from "../application/menu-document"

import type { MenuRepository } from "../application/ports"

import type { StoragePort } from "./legacy-migration"

export const menuStorageKey = (id: string) =>
  `saas-cardapio:v1:restaurant:${identifier(id)}`

export interface StorageEvents {
  subscribe(key: string, listener: () => void): () => void
  emit(key: string): void
}

export class LocalMenuRepository implements MenuRepository {
  private readonly seen = new Set<string>()

  constructor(
    private readonly storage: () => StoragePort,
    private readonly locks: ExclusiveLock,

    private readonly events: StorageEvents,

    private readonly initialize: (storage: StoragePort, id: string) => MenuDocument,
  ) {}

  private read(id: string): MenuDocument | null {
    let raw: string | null

    try {
      raw = this.storage().getItem(menuStorageKey(id))
    } catch {
      throw new Failure(
        "STORAGE_UNAVAILABLE",
        "Não foi possível ler o armazenamento. Verifique as permissões do navegador e tente novamente.",
        {},
        "storage_read_failed",
      )
    }

    if (raw === null) return null

    try {
      const document = parseMenuDocument(JSON.parse(raw), id)

      this.seen.add(id)

      return document
    } catch (error: unknown) {
      throw new Failure(
        "CORRUPT_DATA",
        "Os dados salvos estão inválidos ou possuem versão incompatível. Nada foi substituído.",

        error instanceof Failure ? error.fields : {},
        error instanceof SyntaxError ? "stored_json_invalid" : "stored_schema_invalid",
      )
    }
  }

  private write(id: string, document: MenuDocument): void {
    try {
      this.storage().setItem(menuStorageKey(id), JSON.stringify(document))
    } catch (error: unknown) {
      if (
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED")
      )
        throw new Failure(
          "STORAGE_QUOTA",
          "O armazenamento está cheio. Reduza o tamanho das imagens e tente salvar novamente.",
          {},
          "storage_quota_exceeded",
        )

      throw new Failure(
        "STORAGE_UNAVAILABLE",
        "Não foi possível salvar. Seus dados anteriores foram mantidos; verifique as permissões e tente novamente.",
        {},
        "storage_write_failed",
      )
    }

    this.seen.add(id)
  }

  async load(id: string): Promise<MenuDocument> {
    const current = this.read(id)

    if (current) return current

    if (this.seen.has(id))
      throw new Failure(
        "CORRUPT_DATA",
        "Os dados desta loja foram removidos do armazenamento. Recarregue após verificar a origem da alteração.",
      )

    return this.locks.run(menuStorageKey(id), async () => {
      const existing = this.read(id)

      if (existing) return existing

      let initial: MenuDocument

      try {
        initial = parseMenuDocument(this.initialize(this.storage(), id), id)
      } catch (error: unknown) {
        if (error instanceof Failure) throw error

        throw new Failure(
          "STORAGE_UNAVAILABLE",
          "Não foi possível inicializar os dados locais. Verifique as permissões do navegador.",
        )
      }

      this.write(id, initial)

      this.events.emit(menuStorageKey(id))

      return initial
    })
  }

  async commit(
    id: string,
    expectedRevision: number,
    next: MenuDocument,
  ): Promise<MenuDocument> {
    requireValid(
      Number.isSafeInteger(expectedRevision) &&
        expectedRevision >= 0 &&
        expectedRevision < Number.MAX_SAFE_INTEGER,
      "Revisão inválida.",
    )

    const validated = parseMenuDocument(next, id)

    return this.locks.run(menuStorageKey(id), async () => {
      const current = this.read(id)

      if (!current)
        throw new Failure("NOT_FOUND", "Os dados desta loja não estão mais disponíveis.")

      if (
        current.revision !== expectedRevision ||
        validated.revision !== expectedRevision
      )
        throw new Failure(
          "CONFLICT",
          "Outra alteração foi salva. Atualize os dados antes de tentar novamente.",
          {},
          "stale_revision",
        )

      const saved = { ...validated, revision: expectedRevision + 1 }

      this.write(id, saved)

      this.events.emit(menuStorageKey(id))

      return saved
    })
  }

  subscribe(id: string, listener: () => void) {
    return this.events.subscribe(menuStorageKey(id), listener)
  }
}
