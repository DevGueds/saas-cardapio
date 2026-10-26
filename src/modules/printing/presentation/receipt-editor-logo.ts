import { printingLogoSchema } from "@cardapio/contracts"

const invalidLogo = () =>
  new Error("Selecione uma imagem PNG, JPEG ou WebP válida, de até 5 MB.")

/** Decode a local raster and re-encode its pixels; never embed a remote URL or SVG. */
export async function normalizeReceiptLogo(
  file: File,
  signal: AbortSignal,
): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5_000_000 ||
    !file.size
  )
    throw invalidLogo()
  signal.throwIfAborted()
  const bytes = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  const signature =
    file.type === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  if (!signature || bytes.byteLength !== file.size) throw invalidLogo()
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer)
        signal.removeEventListener("abort", cancel)
        image.onload = image.onerror = null
        if (error) reject(error)
        else resolve()
      }
      const cancel = () => finish(new DOMException("Cancelado", "AbortError"))
      const timer = setTimeout(() => finish(invalidLogo()), 8000)
      image.onload = () => finish()
      image.onerror = () => finish(invalidLogo())
      signal.addEventListener("abort", cancel, { once: true })
      image.src = url
      if (signal.aborted) cancel()
    })
    signal.throwIfAborted()
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw invalidLogo()
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Não foi possível preparar o logo neste navegador.")
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = printingLogoSchema.safeParse(canvas.toDataURL("image/png"))
    if (!result.success)
      throw new Error("O logo ficou muito grande. Selecione uma imagem mais simples.")
    return result.data
  } finally {
    image.src = ""
    URL.revokeObjectURL(url)
  }
}
