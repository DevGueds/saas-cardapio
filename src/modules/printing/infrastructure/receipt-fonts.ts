import type { jsPDF } from "jspdf"
import { Failure } from "../../../shared/domain/failure"
import regularUrl from "./receipt-fonts/NotoSans-Regular.ttf?url"
import boldUrl from "./receipt-fonts/NotoSans-Bold.ttf?url"

export interface ReceiptFonts {
  regular: string
  bold: string
}
export const receiptFontName = "ReceiptNotoSans"
let pending: Promise<ReceiptFonts> | undefined
let canvasPending: Promise<void> | undefined

function base64(bytes: Uint8Array): string {
  let value = ""
  for (let index = 0; index < bytes.length; index += 8192)
    value += String.fromCharCode(...bytes.subarray(index, index + 8192))
  return btoa(value)
}

/** Only bundled local assets are fetched; receipt data can never choose a URL. */
export function loadReceiptFonts(): Promise<ReceiptFonts> {
  pending ??= Promise.all(
    [regularUrl, boldUrl].map(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok)
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "Não foi possível carregar as fontes do comprovante. Recarregue a página e tente novamente.",
        )
      return base64(new Uint8Array(await response.arrayBuffer()))
    }),
  )
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error: unknown) => {
      pending = undefined
      if (
        error instanceof DOMException &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "O carregamento das fontes demorou demais. Tente gerar o comprovante novamente.",
        )
      throw error
    })
  return pending
}

export function registerReceiptFonts(doc: jsPDF, fonts: ReceiptFonts): void {
  doc.addFileToVFS("receipt-regular.ttf", fonts.regular)
  doc.addFont("receipt-regular.ttf", receiptFontName, "normal")
  doc.addFileToVFS("receipt-bold.ttf", fonts.bold)
  doc.addFont("receipt-bold.ttf", receiptFontName, "bold")
  doc.setFont(receiptFontName, "normal")
}

export function receiptFontCss(fonts: ReceiptFonts): string {
  return `@font-face{font-family:${receiptFontName};src:url(data:font/ttf;base64,${fonts.regular}) format('truetype');font-weight:400;font-style:normal}@font-face{font-family:${receiptFontName};src:url(data:font/ttf;base64,${fonts.bold}) format('truetype');font-weight:700;font-style:normal}`
}

export async function loadReceiptCanvasFonts(fonts: ReceiptFonts): Promise<void> {
  if (typeof FontFace === "undefined" || !document.fonts)
    throw new Failure(
      "CAPABILITY_UNAVAILABLE",
      "Este navegador não permite preparar a imagem térmica. Use o PDF ou outro navegador atualizado.",
    )
  canvasPending ??= Promise.all(
    (["regular", "bold"] as const).map(async (weight) => {
      const font = new FontFace(
        receiptFontName,
        `url(data:font/ttf;base64,${fonts[weight]})`,
        { weight: weight === "bold" ? "700" : "400" },
      )
      await font.load()
      document.fonts.add(font)
    }),
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      canvasPending = undefined
      throw error
    })
  await canvasPending
}
