import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder"
import type { PrinterProfile } from "@cardapio/domain/printing"
import { Failure } from "../../../shared/domain/failure"
import type { ReceiptLayout, ReceiptPage } from "./receipt-layout"
import {
  loadReceiptCanvasFonts,
  receiptFontName,
  type ReceiptFonts,
} from "./receipt-fonts"

function loadLogo(data: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = setTimeout(() => {
      image.onload = null
      image.onerror = null
      reject(
        new Failure(
          "VALIDATION",
          "A logo não pôde ser carregada. Selecione um PNG válido.",
        ),
      )
    }, 10_000)
    image.onload = () => {
      clearTimeout(timeout)
      resolve(image)
    }
    image.onerror = () => {
      clearTimeout(timeout)
      reject(
        new Failure(
          "VALIDATION",
          "A logo não pôde ser carregada. Selecione um PNG válido.",
        ),
      )
    }
    image.src = data
  })
}

/** At 203 dpi thermal printheads conventionally use exactly eight dots/mm. */
export function receiptRasterSize(profile: PrinterProfile, layout: ReceiptLayout) {
  const dotsPerMm = profile.dpi === 203 ? 8 : profile.dpi / 25.4
  const width = Math.floor((layout.contentWidth * dotsPerMm) / 8) * 8
  const height = Math.ceil(layout.height * dotsPerMm)
  if (width < 8 || width > 1024 || height > 4096 || width * height > 4_000_000)
    throw new Failure(
      "VALIDATION",
      "O perfil excede os limites da imagem térmica. Confira a largura e a resolução.",
    )
  return { width, height, dotsPerMm }
}

async function pageImage(
  page: ReceiptPage,
  profile: PrinterProfile,
  layout: ReceiptLayout,
): Promise<ImageData> {
  const { width, height, dotsPerMm } = receiptRasterSize(profile, layout)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context)
    throw new Failure(
      "CAPABILITY_UNAVAILABLE",
      "Este navegador não consegue preparar a impressão térmica. Use o PDF.",
    )
  context.fillStyle = "#fff"
  context.fillRect(0, 0, width, height)
  const scaleX = width / layout.contentWidth
  context.save()
  context.scale(scaleX, dotsPerMm)
  context.translate(-layout.contentX, 0)
  context.fillStyle = "#000"
  context.strokeStyle = "#000"
  context.lineWidth = 0.2
  context.textBaseline = "alphabetic"
  for (const drawing of page.drawings) {
    if (drawing.type === "text") {
      context.font = `${drawing.bold ? 700 : 400} ${(drawing.fontSize * 25.4) / 72}px ${receiptFontName}`
      context.textAlign = drawing.align
      context.fillText(drawing.text, drawing.x, drawing.y)
    } else if (drawing.type === "line") {
      context.beginPath()
      context.moveTo(drawing.x, drawing.y)
      context.lineTo(drawing.x + drawing.width, drawing.y)
      context.stroke()
    } else {
      const image = await loadLogo(drawing.data)
      context.drawImage(image, drawing.x, drawing.y, drawing.width, drawing.height)
    }
  }
  context.restore()
  const result = context.getImageData(0, 0, width, height)
  canvas.width = 0
  canvas.height = 0
  return result
}

/** Produces a file; never opens USB, Bluetooth, a socket, a spooler or a drawer. */
export async function encodeReceiptEscpos(
  profile: PrinterProfile,
  layout: ReceiptLayout,
  fonts: ReceiptFonts,
): Promise<Uint8Array> {
  await loadReceiptCanvasFonts(fonts)
  return encodeReceiptRasterPages(profile, layout, (page) =>
    pageImage(page, profile, layout),
  )
}

/** Separate the byte protocol from browser drawing so it can be verified without hardware. */
export async function encodeReceiptRasterPages(
  profile: PrinterProfile,
  layout: ReceiptLayout,
  rasterize: (page: ReceiptPage) => Promise<ImageData>,
): Promise<Uint8Array> {
  const raster = receiptRasterSize(profile, layout)
  if (((raster.width * raster.height) / 8 + 1024) * layout.pages.length > 8_000_000)
    throw new Failure(
      "VALIDATION",
      "O arquivo térmico excede 8 MB. Reduza as vias, a resolução ou o conteúdo do modelo.",
    )
  const encoder = new ReceiptPrinterEncoder({
    language: "esc-pos",
    imageMode: "raster",
    feedAfterBlock: false,
    feedBeforeCut: 0,
    errors: "strict",
    columns: Math.ceil(
      (layout.contentWidth * (profile.dpi === 203 ? 8 : profile.dpi / 25.4)) / 12,
    ),
  })
  encoder.initialize()
  for (let index = 0; index < layout.pages.length; index++) {
    const page = layout.pages[index]
    const pixels = await rasterize(page)
    encoder.image(pixels, {
      width: pixels.width,
      height: pixels.height,
      algorithm: "threshold",
      threshold: 160,
      mode: "raster",
    })
    if (!layout.pages[index + 1] || layout.pages[index + 1].copy !== page.copy) {
      if (profile.feedLines) encoder.newline(profile.feedLines)
      if (profile.cut !== "NONE")
        encoder.cut(profile.cut === "PARTIAL" ? "partial" : "full")
    }
  }
  const bytes = encoder.encode()
  if (bytes.byteLength > 8_000_000)
    throw new Failure(
      "VALIDATION",
      "O arquivo térmico excede 8 MB. Reduza as vias, a resolução ou o conteúdo do modelo.",
    )
  return bytes
}
