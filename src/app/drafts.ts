import { createReduxDrafts } from "../shared/infrastructure/redux-drafts"
import { PrivateCheckoutStorage } from "../shared/infrastructure/private-checkout-storage"
export function browserDrafts() {
  const storage = new PrivateCheckoutStorage(
    () => window.localStorage,
    () => window.sessionStorage,
  )
  return createReduxDrafts(() => storage)
}
