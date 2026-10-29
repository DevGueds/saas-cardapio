import type { PrivacyNoticeStore } from "../application/privacy-notice"
export class BrowserPrivacyNotice implements PrivacyNoticeStore {
  constructor(private readonly storage: () => Pick<Storage, "getItem" | "setItem">) {}
  acknowledged(version: string) {
    try {
      return this.storage().getItem("pede-aqui:privacy-notice") === version
    } catch {
      return false
    }
  }
  acknowledge(version: string) {
    try {
      this.storage().setItem("pede-aqui:privacy-notice", version)
      return true
    } catch {
      return false
    }
  }
}
