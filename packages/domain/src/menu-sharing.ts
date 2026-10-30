import { requireValid } from "./failure.js"
import { imageReference, record, text } from "./validation.js"

export interface MenuSharing {
  title: string
  description: string
  format: "SQUARE" | "LANDSCAPE"
  squareImage: string
  landscapeImage: string
}
export function defaultMenuSharing(): MenuSharing {
  return {
    title: "",
    description: "",
    format: "SQUARE",
    squareImage: "",
    landscapeImage: "",
  }
}
export function parseMenuSharing(input: unknown): MenuSharing {
  const value = record(input)
  requireValid(
    value.format === "SQUARE" || value.format === "LANDSCAPE",
    "Escolha o formato da imagem.",
    "format",
  )
  const image = (field: string) => {
    const result = imageReference(value[field], field)
    requireValid(
      result === "" || result.startsWith("data:image/"),
      "Envie uma imagem PNG, JPEG ou WebP de até 5 MB.",
      field,
    )
    return result
  }
  return {
    title: text(value.title, "title", 100),
    description: text(value.description, "description", 240),
    format: value.format,
    squareImage: image("squareImage"),
    landscapeImage: image("landscapeImage"),
  }
}
