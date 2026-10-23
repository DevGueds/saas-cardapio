import type { Account, SessionRecord } from "./ports.js"
export function mfaRequired(user: Account) {
  return (
    user.memberships?.some(
      (member) =>
        member.active &&
        member.tenant.active &&
        (member.mfaOverride === "REQUIRED" ||
          (member.mfaOverride === "INHERIT" && member.tenant.mfaRequired)),
    ) ?? false
  )
}
export function mfaState(
  record: SessionRecord,
): "NONE" | "ENROLL" | "VERIFY" | "VERIFIED" {
  if (record.user.mfa?.enabledAt) return record.mfaVerifiedAt ? "VERIFIED" : "VERIFY"
  return mfaRequired(record.user) ? "ENROLL" : "NONE"
}
export function mfaPending(record: SessionRecord) {
  return ["ENROLL", "VERIFY"].includes(mfaState(record))
}
