export type PasswordStrength = "empty" | "weak" | "medium" | "strong" | "very-strong"

/** A conservative local indicator, never a claim about time needed to crack a password. */
export function passwordStrength(password: string): {
  level: PasswordStrength
  accepted: boolean
  length: number
} {
  const chars = Array.from(password)
  const length = chars.length
  const result = (level: PasswordStrength) => ({
    level,
    accepted: ["medium", "strong", "very-strong"].includes(level),
    length,
  })
  if (!length) return result("empty")
  if (length < 8 || length > 128) return result("weak")
  const folded = password
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
  const normalized = folded.replace(
    /[013457@$!]/g,
    (c) =>
      ({
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
        "@": "a",
        $: "s",
        "!": "i",
      })[c]!,
  )
  const common =
    /password|senha|qwerty|asdfgh|zxcvbn|letmein|welcome|bemvindo|admin|iloveyou|changeme|abc123|123456|654321|111111|000000/
  if (
    common.test(folded) ||
    common.test(normalized) ||
    new Set(chars).size < 5 ||
    /(.{1,4})\1{2,}/u.test(folded)
  )
    return result("weak")
  const classes = [/[\p{Ll}]/u, /[\p{Lu}]/u, /\p{N}/u, /[^\p{L}\p{N}\s]/u].filter(
    (rule) => rule.test(password),
  ).length
  const words = new Set(folded.split(/[^\p{L}]+/u).filter((word) => word.length >= 3))
    .size
  // Obvious numeric/alphabetic walks are especially predictable in short passwords.
  if (
    length < 16 &&
    /0123|1234|2345|3456|4567|5678|6789|9876|8765|abcd|bcde|cdef|qwer|asdf/.test(folded)
  )
    return result("weak")
  if ((length >= 24 && words >= 4) || (length >= 18 && classes >= 3))
    return result("very-strong")
  if (
    (length >= 20 && words >= 3) ||
    (length >= 12 && classes >= 3) ||
    (length >= 16 && classes >= 2)
  )
    return result("strong")
  if (
    (length >= 8 && classes >= 3) ||
    (length >= 10 && classes >= 2) ||
    (length >= 16 && words >= 3)
  )
    return result("medium")
  return result("weak")
}
