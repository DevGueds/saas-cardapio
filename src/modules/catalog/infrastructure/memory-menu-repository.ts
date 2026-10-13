import { Failure } from "../../../shared/domain/failure"

import { parseMenuDocument, type MenuDocument } from "../application/menu-document"

import type { MenuRepository } from "../application/ports"

export class MemoryMenuRepository implements MenuRepository {
  private readonly documents = new Map<string, MenuDocument>()

  private readonly listeners = new Map<string, Set<() => void>>()

  constructor(documents: readonly MenuDocument[] = []) {
    for (const document of documents)
      this.documents.set(
        document.restaurant.id,
        parseMenuDocument(document, document.restaurant.id),
      )
  }

  async load(id: string) {
    const document = this.documents.get(id)

    if (!document) throw new Failure("NOT_FOUND", "Restaurante não encontrado.")

    return structuredClone(document)
  }

  async commit(id: string, expectedRevision: number, next: MenuDocument) {
    const current = this.documents.get(id)

    if (!current) throw new Failure("NOT_FOUND", "Restaurante não encontrado.")

    if (current.revision !== expectedRevision || next.revision !== expectedRevision)
      throw new Failure(
        "CONFLICT",
        "Outra alteração foi salva. Atualize os dados antes de tentar novamente.",
      )

    const saved = parseMenuDocument({ ...next, revision: expectedRevision + 1 }, id)

    this.documents.set(id, saved)

    this.listeners.get(id)?.forEach((listener) => listener())

    return structuredClone(saved)
  }

  subscribe(id: string, listener: () => void) {
    const listeners = this.listeners.get(id) ?? new Set()

    listeners.add(listener)
    this.listeners.set(id, listeners)

    return () => {
      listeners.delete(listener)
    }
  }
}
