import { DRAFT_PREFIX, type DraftStorage } from "../application/drafts"

const personalCheckout = (key: string) =>
  key.startsWith(DRAFT_PREFIX) &&
  /^(?:api|demo):customer:[a-zA-Z0-9_-]+:checkout$/.test(key.slice(DRAFT_PREFIX.length))

/** Personal checkout data stays in this tab; cart and delivery receipts keep their existing scope. */
export class PrivateCheckoutStorage implements DraftStorage {
  constructor(
    private readonly persistent: () => DraftStorage,
    private readonly tab: () => DraftStorage,
  ) {}
  private keys() {
    return [
      ...new Set(
        [this.persistent(), this.tab()].flatMap((storage) =>
          Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
            (key): key is string => key !== null,
          ),
        ),
      ),
    ]
  }
  get length() {
    return this.keys().length
  }
  key(index: number) {
    return this.keys()[index] ?? null
  }
  getItem(key: string) {
    if (!personalCheckout(key)) return this.persistent().getItem(key)
    const tab = this.tab(),
      persistent = this.persistent()
    const current = tab.getItem(key),
      legacy = persistent.getItem(key)
    if (current === null && legacy !== null) tab.setItem(key, legacy)
    if (legacy !== null) persistent.removeItem(key)
    return current ?? legacy
  }
  setItem(key: string, value: string) {
    if (!personalCheckout(key)) {
      this.persistent().setItem(key, value)
      return
    }
    this.tab().setItem(key, value)
    this.persistent().removeItem(key)
  }
  removeItem(key: string) {
    if (personalCheckout(key)) this.tab().removeItem(key)
    this.persistent().removeItem(key)
  }
}
