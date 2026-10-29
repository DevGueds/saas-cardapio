export interface PrivacyNoticeStore {
  acknowledged(version: string): boolean
  acknowledge(version: string): boolean
}
