import { BrowserPrivacyNotice } from "../shared/infrastructure/browser-privacy-notice"

export function browserPrivacyNotice() {
  return new BrowserPrivacyNotice(() => window.localStorage)
}
