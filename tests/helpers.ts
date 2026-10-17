import { Executor } from "../src/shared/application/execute"

import type { DiagnosticEvent, ExclusiveLock } from "../src/shared/application/ports"

import { DemoAccessPolicy } from "../src/shared/infrastructure/browser-services"

import { initializeDemo } from "../src/modules/catalog/infrastructure/legacy-migration"

import { MemoryMenuRepository } from "../src/modules/catalog/infrastructure/memory-menu-repository"

import { CatalogCommands } from "../src/modules/catalog/application/catalog-commands"

import { RestaurantCommands } from "../src/modules/restaurant/application/restaurant-commands"

import { PrepareOrder } from "../src/modules/checkout/application/prepare-order"

import type { StorageEvents } from "../src/modules/catalog/infrastructure/local-menu-repository"

import type { MenuDocument } from "../src/modules/catalog/application/menu-document"

export class TestStorage {
  get length() {
    return this.values.size
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    if (this.writeError) throw this.writeError
    this.values.delete(key)
  }
  values = new Map<string, string>()

  writeError: Error | null = null

  readError: Error | null = null

  getItem(key: string) {
    if (this.readError) throw this.readError
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.writeError) throw this.writeError
    this.values.set(key, value)
  }
}

export class SerialLock implements ExclusiveLock {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(_name: string, action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(action, action)

    this.tail = result.catch(() => {})

    return result
  }
}

export class TestEvents implements StorageEvents {
  count = 0

  listeners = new Map<string, Set<() => void>>()

  emit(key: string) {
    this.count++
    this.listeners.get(key)?.forEach((listener) => listener())
  }

  subscribe(key: string, listener: () => void) {
    const list = this.listeners.get(key) ?? new Set()
    list.add(listener)
    this.listeners.set(key, list)

    return () => {
      list.delete(listener)
    }
  }
}

export function sampleMenu(id = "demo-store"): MenuDocument {
  const menu = initializeDemo(new TestStorage(), "demo-store")

  return {
    ...menu,
    restaurant: {
      ...menu.restaurant,
      id,
      slug: id === "demo-store" ? "burger-house" : id,

      whatsapp: "5511999998888",
      whatsappConfigured: true,
    },

    categories: menu.categories.map((category) => ({
      ...category,
      restaurantId: id,
    })),

    products: menu.products.map((product) => ({
      ...product,
      restaurantId: id,
    })),
  }
}

export function testServices(
  documents = [sampleMenu()],
  mode: string | undefined = "demo",
) {
  const repository = new MemoryMenuRepository(documents)

  const events: DiagnosticEvent[] = []

  let nextId = 0

  const ids = { next: () => `test-${++nextId}` }

  const executor = new Executor({ record: (event) => events.push(event) }, ids)

  const access = new DemoAccessPolicy(mode)

  return {
    repository,
    events,
    executor,
    access,
    ids,

    catalog: new CatalogCommands(repository, access, ids, executor),

    restaurant: new RestaurantCommands(repository, access, executor),

    checkout: new PrepareOrder(repository, access, executor),
  }
}
