import { Failure } from "../domain/failure"

const imageFailure = () =>
  new Failure(
    "VALIDATION",
    "Não foi possível carregar o logo. Envie uma imagem PNG, JPEG ou WebP nas configurações da loja ou desative o logo.",
  )

function loadImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const finish = (error?: unknown) => {
      clearTimeout(timer)
      signal.removeEventListener("abort", cancel)
      image.onload = image.onerror = null
      if (error) {
        image.src = ""
        reject(error)
      } else resolve(image)
    }
    const cancel = () => finish(new DOMException("Cancelled", "AbortError"))
    const timer = setTimeout(() => finish(imageFailure()), 8000)
    image.crossOrigin = "anonymous"
    image.referrerPolicy = "no-referrer"
    image.onload = () => finish()
    image.onerror = () => finish(imageFailure())
    signal.addEventListener("abort", cancel, { once: true })
    if (signal.aborted) cancel()
    else image.src = source
  })
}

/** Embed a bounded raster, preserving aspect ratio and transparency on white.
 * No fetch/XHR: the production CSP intentionally restricts connect-src to self.
 */
export async function prepareQrLogo(source: string, signal: AbortSignal) {
  const image = await loadImage(source, signal)
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth * image.naturalHeight > 40_000_000
  )
    throw imageFailure()
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  const context = canvas.getContext("2d")
  if (!context) throw imageFailure()
  context.fillStyle = "white"
  context.fillRect(0, 0, 256, 256)
  const scale = 240 / Math.max(image.naturalWidth, image.naturalHeight)
  const width = image.naturalWidth * scale,
    height = image.naturalHeight * scale
  context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height)
  try {
    return canvas.toDataURL("image/png")
  } catch {
    throw imageFailure()
  }
}

export async function qrPng(svg: Blob, signal: AbortSignal) {
  const url = URL.createObjectURL(svg)
  try {
    const image = await loadImage(url, signal)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 800
    const context = canvas.getContext("2d")
    if (!context) throw new Failure("UNEXPECTED", "Não foi possível exportar o QR Code.")
    context.drawImage(image, 0, 0, 800, 800)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Failure("UNEXPECTED", "Não foi possível exportar o QR Code.")),
        "image/png",
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadQr(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
