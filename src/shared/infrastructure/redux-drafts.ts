import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit"
import {
  DRAFT_PREFIX,
  DRAFT_TTL,
  type DraftEntry,
  type DraftManager,
  type DraftStorage,
} from "../application/drafts"
const maximumBytes = 2_000_000
const validKey = (key: string) =>
  /^(?:demo|api):(?:customer:[a-zA-Z0-9_-]{1,100}|admin:[a-zA-Z0-9_-]{1,100}:[a-zA-Z0-9_-]{1,100}):[a-zA-Z0-9:_-]{1,160}$/.test(
    key,
  )
const unavailable =
  "Não foi possível salvar o rascunho neste navegador. Mantenha esta página aberta."
const conflict =
  "Este rascunho mudou em outra aba. Recarregue para recuperá-lo ou descarte o rascunho antes de continuar."
const corrupt =
  "O rascunho salvo não pôde ser validado. Descarte-o explicitamente para começar novamente."
const slice = createSlice({
  name: "drafts",
  initialState: {} as Record<string, DraftEntry>,
  reducers: {
    put(state, action: PayloadAction<{ key: string; entry: DraftEntry }>) {
      state[action.payload.key] = action.payload.entry
    },
    remove(state, action: PayloadAction<string>) {
      delete state[action.payload]
    },
  },
})
function decode(raw: string, now: number): DraftEntry | undefined {
  if (raw.length > maximumBytes) throw new Error("draft_size")
  const item: unknown = JSON.parse(raw)
  if (
    !item ||
    typeof item !== "object" ||
    !("version" in item) ||
    item.version !== 1 ||
    !("updatedAt" in item) ||
    typeof item.updatedAt !== "number" ||
    !Number.isFinite(item.updatedAt) ||
    !("expiresAt" in item) ||
    typeof item.expiresAt !== "number" ||
    item.expiresAt < item.updatedAt ||
    item.expiresAt - item.updatedAt > 30 * DRAFT_TTL ||
    !("value" in item)
  )
    throw new Error("draft_format")
  if (item.expiresAt <= now) return undefined
  return {
    value: item.value,
    updatedAt: item.updatedAt,
    expiresAt: item.expiresAt,
    issue: null,
  }
}
export function createReduxDrafts(
  storage: () => DraftStorage,
  now: () => number = Date.now,
): DraftManager {
  const initial: Record<string, DraftEntry> = {},
    observed = new Map<string, string | null>(),
    dirty = new Set<string>()
  try {
    const source = storage()
    const keys = Array.from({ length: source.length }, (_, i) => source.key(i))
    for (const full of keys) {
      if (!full?.startsWith(DRAFT_PREFIX)) continue
      const key = full.slice(DRAFT_PREFIX.length),
        raw = source.getItem(full)
      if (raw === null || !validKey(key)) continue
      observed.set(key, raw)
      try {
        const entry = decode(raw, now())
        if (entry) initial[key] = entry
        else {
          source.removeItem(full)
          observed.set(key, null)
        }
      } catch {
        initial[key] = {
          value: null,
          updatedAt: now(),
          expiresAt: now() + DRAFT_TTL,
          issue: corrupt,
        }
      }
    }
  } catch {
    /* A write exposes unavailable storage without inventing a successful save. */
  }
  const store = configureStore({
    reducer: slice.reducer,
    preloadedState: initial,
    devTools: false,
  })
  const put = (key: string, entry: DraftEntry) =>
    store.dispatch(slice.actions.put({ key, entry }))
  const manager: DraftManager = {
    snapshot: (key) => store.getState()[key],
    subscribe: (listener) => store.subscribe(listener),
    set(key, value, ttlMs = DRAFT_TTL) {
      if (!validKey(key)) return false
      const previous = store.getState()[key],
        at = now(),
        entry: DraftEntry = {
          value,
          updatedAt: at,
          expiresAt: at + Math.min(ttlMs, 30 * DRAFT_TTL),
          issue: null,
        }
      dirty.add(key)
      try {
        const source = storage(),
          full = DRAFT_PREFIX + key,
          raw = source.getItem(full)
        if (
          previous?.issue === corrupt ||
          previous?.issue === conflict ||
          raw !== (observed.get(key) ?? null)
        ) {
          put(key, { ...entry, issue: previous?.issue === corrupt ? corrupt : conflict })
          return false
        }
        const encoded = JSON.stringify({
          version: 1,
          value,
          updatedAt: at,
          expiresAt: entry.expiresAt,
        })
        if (encoded.length > maximumBytes) throw new Error("draft_size")
        source.setItem(full, encoded)
        observed.set(key, encoded)
        put(key, entry)
        return true
      } catch {
        put(key, { ...entry, issue: unavailable })
        return false
      }
    },
    clear(key) {
      try {
        storage().removeItem(DRAFT_PREFIX + key)
        observed.set(key, null)
        dirty.delete(key)
        store.dispatch(slice.actions.remove(key))
      } catch {
        const entry = store.getState()[key]
        if (entry) put(key, { ...entry, issue: unavailable })
      }
    },
    clearPrefix(prefix) {
      const keys = new Set([...Object.keys(store.getState()), ...observed.keys()])
      try {
        const source = storage()
        for (let i = 0; i < source.length; i++) {
          const full = source.key(i)
          if (full?.startsWith(DRAFT_PREFIX)) keys.add(full.slice(DRAFT_PREFIX.length))
        }
      } catch {
        /* clear reports unavailable storage for known entries. */
      }
      for (const key of keys) if (key.startsWith(prefix)) manager.clear(key)
    },
    receive(full, raw) {
      if (full === null) {
        for (const key of Object.keys(store.getState()))
          manager.receive(DRAFT_PREFIX + key, null)
        return
      }
      if (!full.startsWith(DRAFT_PREFIX)) return
      const key = full.slice(DRAFT_PREFIX.length)
      if (!validKey(key)) return
      const current = store.getState()[key]
      if (raw === (observed.get(key) ?? null)) return
      if (dirty.has(key) && current) {
        put(key, { ...current, issue: conflict })
        return
      }
      observed.set(key, raw)
      try {
        const entry = raw === null ? undefined : decode(raw, now())
        if (entry) put(key, entry)
        else store.dispatch(slice.actions.remove(key))
      } catch {
        put(key, {
          value: current?.value ?? null,
          updatedAt: now(),
          expiresAt: now() + DRAFT_TTL,
          issue: corrupt,
        })
      }
    },
  }
  return manager
}
