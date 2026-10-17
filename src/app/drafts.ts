import { createReduxDrafts } from "../shared/infrastructure/redux-drafts"
export function browserDrafts() {
  return createReduxDrafts(() => window.localStorage)
}
