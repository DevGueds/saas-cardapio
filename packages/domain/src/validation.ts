import { requireValid } from "./failure.js"

export function record(value: unknown): Record<string, unknown> {
  requireValid(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "Estrutura de dados inválida.",
  )

  return value as Record<string, unknown>
}

export function text(
  value: unknown,
  field: string,
  max: number,
  required = false,
): string {
  requireValid(
    typeof value === "string" &&
      value.length <= max &&
      (!required || value.trim().length > 0),

    required
      ? "Preencha este campo com um valor válido."
      : "Valor inválido ou muito longo.",
    field,
  )

  return value.trim()
}

export function identifier(value: unknown, field = "id"): string {
  const id = text(value, field, 100, true)

  requireValid(/^[a-zA-Z0-9_-]+$/.test(id), "Identificador inválido.", field)

  return id
}

export function boolean(value: unknown, field: string): boolean {
  requireValid(typeof value === "boolean", "Selecione um estado válido.", field)

  return value
}

export function imageReference(value: unknown, field = "imageUrl"): string {
  const image = text(value, field, 7_000_000)

  requireValid(
    image === "" ||
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image) ||
      /^https:\/\/[^\s<>]+$/i.test(image),
    "Use uma imagem PNG, JPEG, WebP ou um endereço HTTPS.",
    field,
  )

  if (image.startsWith("data:")) {
    const encoded = image.slice(image.indexOf(",") + 1)
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0
    requireValid(
      encoded.length % 4 === 0 && (encoded.length / 4) * 3 - padding <= 5 * 1024 * 1024,
      "A imagem deve ter até 5 MB e conteúdo base64 válido.",
      field,
    )
    const header: number[] = []
    let bits = 0,
      accumulator = 0
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    for (const character of encoded.slice(0, 16)) {
      const digit = alphabet.indexOf(character)
      if (digit < 0) break
      accumulator = (accumulator << 6) | digit
      bits += 6
      if (bits >= 8) {
        bits -= 8
        header.push((accumulator >> bits) & 255)
      }
    }
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => header[index] === byte,
    )
    const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
    const webp =
      String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...header.slice(8, 12)) === "WEBP"
    requireValid(
      (image.startsWith("data:image/png;") && png) ||
        (image.startsWith("data:image/jpeg;") && jpeg) ||
        (image.startsWith("data:image/webp;") && webp),
      "O conteúdo da imagem não corresponde ao formato informado.",
      field,
    )
  }
  return image
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
}

export function brazilianPhone(value: unknown, field = "phone"): string {
  const input = text(value, field, 30, true)

  requireValid(
    /^[+\d\s().-]+$/.test(input),
    "Informe um telefone brasileiro com DDD.",
    field,
  )

  let digits = input.replace(/\D/g, "")

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2)

  requireValid(
    /^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits),
    "Informe um telefone brasileiro com DDD.",
    field,
  )

  return `55${digits}`
}
