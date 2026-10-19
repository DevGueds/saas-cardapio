import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js"
import type { ContentFingerprint } from "../application/ports"

/** Stable across HTTP/HTTPS; only the digest is persisted, never the input. */
export const sha256Fingerprint: ContentFingerprint = {
  digest: async (value) => bytesToHex(sha256(utf8ToBytes(value))),
}
