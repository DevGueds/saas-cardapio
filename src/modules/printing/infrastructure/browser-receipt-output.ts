import type { ReceiptDocument } from "@cardapio/contracts"
import type { jsPDF } from "jspdf"
import type { ReceiptOutputRenderer } from "../application/receipt-output"
import type { Executor } from "../../../shared/application/execute"
import { Failure } from "../../../shared/domain/failure"
import {
  createReceiptLayout,
  validatedReceiptDocument,
  type ReceiptLayout,
  type ReceiptDrawing,
} from "./receipt-layout"
import {
  loadReceiptFonts,
  receiptFontCss,
  receiptFontName,
  registerReceiptFonts,
  type ReceiptFonts,
} from "./receipt-fonts"

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  )

function svgDrawing(drawing: ReceiptDrawing): string {
  if (drawing.type === "line")
    return `<line x1="${drawing.x}" y1="${drawing.y}" x2="${drawing.x + drawing.width}" y2="${drawing.y}" stroke="black" stroke-width="0.2"/>`
  if (drawing.type === "logo")
    return `<image href="${escape(drawing.data)}" x="${drawing.x}" y="${drawing.y}" width="${drawing.width}" height="${drawing.height}" preserveAspectRatio="xMidYMid meet"/>`
  return `<text x="${drawing.x}" y="${drawing.y}" font-family="${receiptFontName}" font-size="${(drawing.fontSize * 25.4) / 72}" font-weight="${drawing.bold ? 700 : 400}" text-anchor="${{ left: "start", center: "middle", right: "end" }[drawing.align]}" xml:space="preserve">${escape(drawing.text)}</text>`
}

export function receiptLayoutHtml(layout: ReceiptLayout, fonts: ReceiptFonts): string {
  const pages = layout.pages
    .map(
      (page, index) =>
        `<section class="receipt-page" aria-label="Via ${page.copy}, página ${page.page}"><svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="receipt-title-${index}"><title id="receipt-title-${index}">${escape(layout.title)} · Via ${page.copy} · Página ${page.page}</title>${page.drawings.map(svgDrawing).join("")}</svg></section>`,
    )
    .join("")
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(layout.title)}</title><style>${receiptFontCss(fonts)}@page{size:${layout.width}mm ${layout.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{font-family:${receiptFontName},sans-serif}.receipt-page{width:${layout.width}mm;height:${layout.height}mm;margin:0 auto 12px;background:#fff;break-after:page;page-break-after:always}.receipt-page:last-child{break-after:auto;page-break-after:auto}svg{display:block;max-width:100%;height:auto}svg text{fill:#000}@media print{html,body{width:${layout.width}mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}.receipt-page{margin:0;max-width:none}svg{max-width:none}}@media screen and (max-width:600px){.receipt-page{max-width:100%;height:auto}}</style></head><body><main>${pages}</main></body></html>`
}

export async function prepareReceipt(input: ReceiptDocument): Promise<{
  input: ReceiptDocument
  doc: jsPDF
  layout: ReceiptLayout
  fonts: ReceiptFonts
}> {
  const validated = validatedReceiptDocument(input)
  const [{ jsPDF: Pdf }, fonts] = await Promise.all([import("jspdf"), loadReceiptFonts()])
  const doc = new Pdf({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
    precision: 4,
  })
  registerReceiptFonts(doc, fonts)
  return { input: validated, doc, fonts, layout: createReceiptLayout(validated, doc) }
}

export function drawReceiptPdf(doc: jsPDF, layout: ReceiptLayout): Blob {
  doc.setProperties({
    title: layout.title,
    subject: "Comprovante não fiscal",
    creator: "Cardápio",
  })
  for (const page of layout.pages) {
    doc.addPage(
      [layout.width, layout.height],
      layout.width > layout.height ? "landscape" : "portrait",
    )
    doc.setTextColor(0)
    doc.setDrawColor(0)
    doc.setLineWidth(0.2)
    for (const drawing of page.drawings) {
      if (drawing.type === "text") {
        doc.setFont(receiptFontName, drawing.bold ? "bold" : "normal")
        doc.setFontSize(drawing.fontSize)
        doc.text(drawing.text, drawing.x, drawing.y, { align: drawing.align })
      } else if (drawing.type === "line") {
        doc.line(drawing.x, drawing.y, drawing.x + drawing.width, drawing.y)
      } else {
        try {
          doc.addImage(
            drawing.data,
            "PNG",
            drawing.x,
            drawing.y,
            drawing.width,
            drawing.height,
          )
        } catch {
          throw new Failure(
            "VALIDATION",
            "Não foi possível ler a logo PNG. Selecione a imagem novamente.",
          )
        }
      }
    }
  }
  // The first page was used only as a font measurement context.
  doc.deletePage(1)
  return doc.output("blob")
}

export class BrowserReceiptOutputRenderer implements ReceiptOutputRenderer {
  constructor(private readonly executor: Executor) {}

  create(input: ReceiptDocument) {
    return this.executor.run("printing", "create_receipt", async () => {
      const { doc, layout, fonts } = await prepareReceipt(input)
      const pdf = drawReceiptPdf(doc, layout)
      return {
        pdf,
        html: receiptLayoutHtml(layout, fonts),
        filename: layout.filename,
        pageCount: layout.pages.length,
        warnings: layout.warnings,
      }
    })
  }

  escpos(input: ReceiptDocument) {
    return this.executor.run("printing", "encode_receipt", async () => {
      const prepared = await prepareReceipt(input)
      if (prepared.input.profile.paperWidthMm > 83)
        throw new Failure(
          "VALIDATION",
          "ESC/POS é destinado a perfis térmicos de até 83 mm. Use o PDF para papel A4.",
        )
      const { encodeReceiptEscpos } = await import("./receipt-escpos")
      const bytes = await encodeReceiptEscpos(
        prepared.input.profile,
        prepared.layout,
        prepared.fonts,
      )
      return {
        bytes,
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/octet-stream",
        }),
        filename: prepared.layout.filename.replace(/\.pdf$/, ".bin"),
      }
    })
  }
}
