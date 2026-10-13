import type { StorageEvents } from "./local-menu-repository"

const SYNC_EVENT = "cardapio:document-saved"

export const browserStorageEvents: StorageEvents = {
  subscribe(key, listener) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) listener()
    }

    const onLocal = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) listener()
    }

    window.addEventListener("storage", onStorage)

    window.addEventListener(SYNC_EVENT, onLocal)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(SYNC_EVENT, onLocal)
    }
  },

  emit(key) {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: key }))
  },
}
