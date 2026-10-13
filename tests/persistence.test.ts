import { describe, expect, it, vi } from "vitest"

import {
  LocalMenuRepository,
  menuStorageKey,
} from "../src/modules/catalog/infrastructure/local-menu-repository"

import {
  initializeDemo,
  LEGACY_KEYS,
} from "../src/modules/catalog/infrastructure/legacy-migration"

import { INITIAL_STORE } from "../src/modules/catalog/infrastructure/demo-fixtures"

import { BrowserExclusiveLock } from "../src/shared/infrastructure/browser-services"

import { SerialLock, TestEvents, TestStorage, sampleMenu } from "./helpers"

function fixture() {
  const storage = new TestStorage()
  const locks = new SerialLock()
  const events = new TestEvents()

  const create = () =>
    new LocalMenuRepository(() => storage, locks, events, initializeDemo)

  return { storage, locks, events, create, repository: create() }
}

describe("persistência local fail-closed", () => {
  it("preserva uma lista vazia após recarregar o repositório", async () => {
    const { repository, create } = fixture()
    const current = await repository.load("demo-store")

    await repository.commit("demo-store", 0, { ...current, products: [] })

    expect((await create().load("demo-store")).products).toEqual([])
  })

  it.each(["{broken", '{"schemaVersion":99}', '"invalid"'])(
    "não substitui dados corrompidos (%s)",
    async (raw) => {
      const { storage, repository } = fixture()
      storage.setItem(menuStorageKey("demo-store"), raw)

      await expect(repository.load("demo-store")).rejects.toMatchObject({
        code: "CORRUPT_DATA",
      })

      expect(storage.getItem(menuStorageKey("demo-store"))).toBe(raw)
    },
  )

  it("não anuncia sucesso nem emite sincronização quando a quota falha", async () => {
    const { storage, repository, events } = fixture()
    const current = await repository.load("demo-store")

    events.count = 0
    storage.writeError = new DOMException("sensitive details", "QuotaExceededError")

    await expect(
      repository.commit("demo-store", 0, { ...current, products: [] }),
    ).rejects.toMatchObject({ code: "STORAGE_QUOTA" })

    expect(events.count).toBe(0)
    expect((await repository.load("demo-store")).revision).toBe(0)

    expect((await repository.load("demo-store")).products).toHaveLength(13)
  })

  it("rejeita permissões de leitura ausentes", async () => {
    const { repository, storage } = fixture()
    storage.readError = new DOMException("secret", "SecurityError")

    await expect(repository.load("demo-store")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    })

    expect(storage.values.size).toBe(0)
  })

  it("grava categoria e produto em um Único documento ou não grava nenhum", async () => {
    const { repository, storage } = fixture()
    const current = await repository.load("demo-store")

    const category = {
      id: "new-category",
      restaurantId: "demo-store",
      name: "Novidades",
    }

    const product = {
      ...current.products[0],
      id: "new-product",
      categoryId: category.id,
    }

    storage.writeError = new DOMException("quota", "QuotaExceededError")

    await expect(
      repository.commit("demo-store", 0, {
        ...current,
        categories: [...current.categories, category],
        products: [...current.products, product],
      }),
    ).rejects.toThrow()

    expect(await repository.load("demo-store")).toEqual(current)

    storage.writeError = null

    const result = await repository.commit("demo-store", 0, {
      ...current,
      categories: [...current.categories, category],
      products: [...current.products, product],
    })

    expect(result.categories).toContainEqual(category)
    expect(result.products).toContainEqual(product)
  })

  it("serializa duas abas e rejeita a revisão obsoleta", async () => {
    const { repository, create } = fixture()
    const otherTab = create()

    const [first, second] = await Promise.all([
      repository.load("demo-store"),
      otherTab.load("demo-store"),
    ])

    const results = await Promise.allSettled([
      repository.commit("demo-store", 0, {
        ...first,
        restaurant: { ...first.restaurant, name: "Primeira alteração" },
      }),

      otherTab.commit("demo-store", 0, { ...second, products: [] }),
    ])

    expect(results[0].status).toBe("fulfilled")

    expect(results[1]).toMatchObject({
      status: "rejected",
      reason: { code: "CONFLICT" },
    })

    const saved = await repository.load("demo-store")
    expect(saved.restaurant.name).toBe("Primeira alteração")
    expect(saved.products).toHaveLength(13)
  })

  it("rejeita documentos de outro restaurante", async () => {
    const { repository, storage } = fixture()
    storage.setItem(
      menuStorageKey("demo-store"),
      JSON.stringify(sampleMenu("outra-loja")),
    )

    await expect(repository.load("demo-store")).rejects.toMatchObject({
      code: "CORRUPT_DATA",
    })
  })

  it("não recria o documento removido durante uma sessão", async () => {
    const { repository, storage } = fixture()
    await repository.load("demo-store")
    storage.values.clear()

    await expect(repository.load("demo-store")).rejects.toMatchObject({
      code: "CORRUPT_DATA",
    })
    expect(storage.values.size).toBe(0)
  })

  it("filtra as notificações por restaurante e permite cancelar assinatura", () => {
    const { repository, events } = fixture()
    const callback = vi.fn()
    const unsubscribe = repository.subscribe("demo-store", callback)

    events.emit(menuStorageKey("outra-loja"))
    expect(callback).not.toHaveBeenCalled()

    events.emit(menuStorageKey("demo-store"))
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    events.emit(menuStorageKey("demo-store"))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("bloqueia gravação sem Web Locks", async () => {
    vi.stubGlobal("navigator", {})

    try {
      await expect(
        new BrowserExclusiveLock().run("test", async () => 1),
      ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("migração", () => {
  it("preserva originais e listas vazias, com idempotência", async () => {
    const { storage, repository, create } = fixture()

    storage.setItem(LEGACY_KEYS[0], JSON.stringify(INITIAL_STORE))
    storage.setItem(LEGACY_KEYS[1], "[]")
    storage.setItem(LEGACY_KEYS[2], "[]")

    const original = [...storage.values]
    const migrated = await repository.load("demo-store")

    expect(migrated.products).toEqual([])
    expect(migrated.categories).toEqual([])

    expect(migrated.restaurant.deliveryFee).toBe(500)
    expect(migrated.restaurant.whatsappConfigured).toBe(false)
    expect(migrated.restaurant.whatsapp).toBe("")

    for (const [key, value] of original) expect(storage.getItem(key)).toBe(value)

    expect(await create().load("demo-store")).toEqual(migrated)
  })

  it("usa padrões somente para chaves nunca persistidas", async () => {
    const { storage, repository } = fixture()
    storage.setItem(LEGACY_KEYS[2], "[]")

    const migrated = await repository.load("demo-store")
    expect(migrated.products).toEqual([])
    expect(migrated.categories).toHaveLength(4)
  })

  it("não troca legado inválido pelos exemplos", async () => {
    const { storage, repository } = fixture()
    storage.setItem(LEGACY_KEYS[2], '[{"id":"incomplete"}]')

    await expect(repository.load("demo-store")).rejects.toMatchObject({
      code: "CORRUPT_DATA",
    })

    expect(storage.getItem(menuStorageKey("demo-store"))).toBeNull()
    expect(storage.getItem(LEGACY_KEYS[2])).toBe('[{"id":"incomplete"}]')
  })
})
