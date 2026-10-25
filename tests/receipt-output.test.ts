import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { jsPDF } from "jspdf"
import { defaultPrintingSettings, type ReceiptKind } from "@cardapio/domain/printing"
import { printerProfileSchema, type ReceiptDocument } from "@cardapio/contracts"
import { Executor } from "../src/shared/application/execute"
import {
  presetProfile,
  printerModels,
} from "../src/modules/printing/domain/printer-models"
import {
  BrowserReceiptOutputRenderer,
  drawReceiptPdf,
  receiptLayoutHtml,
} from "../src/modules/printing/infrastructure/browser-receipt-output"
import {
  createReceiptLayout,
  receiptLogoSize,
  validatedReceiptDocument,
  type ReceiptLayout,
} from "../src/modules/printing/infrastructure/receipt-layout"
import {
  receiptFontName,
  registerReceiptFonts,
} from "../src/modules/printing/infrastructure/receipt-fonts"
import {
  encodeReceiptRasterPages,
  receiptRasterSize,
} from "../src/modules/printing/infrastructure/receipt-escpos"

const fonts = {
  regular: readFileSync(
    resolve("src/modules/printing/infrastructure/receipt-fonts/NotoSans-Regular.ttf"),
  ).toString("base64"),
  bold: readFileSync(
    resolve("src/modules/printing/infrastructure/receipt-fonts/NotoSans-Bold.ttf"),
  ).toString("base64"),
}
const orderId = "11111111-1111-4111-8111-111111111111"
const paymentId = "22222222-2222-4222-8222-222222222222"
const registeredAt = "2026-10-25T12:00:00.000Z"

function fixture(kind: ReceiptKind = "ORDER", modelId = "generic-80", itemCount = 1) {
  const document: ReceiptDocument = {
    profile: presetProfile(modelId, "test-profile"),
    template: defaultPrintingSettings().templates[kind],
    snapshot: {
      kind,
      generatedAt: "2026-10-25T13:00:00.000Z",
      restaurant: {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Loja de teste — São João",
        address: "Rua de teste, 123",
        phone: "11999999999",
        logo: "",
      },
      source: {
        orderId: kind === "PAYMENT" ? null : orderId,
        paymentId: kind === "PAYMENT" ? paymentId : null,
        orderRevision: kind === "PAYMENT" ? null : 3,
        createdAt: registeredAt,
        status: kind === "PAYMENT" ? null : "NEW",
        paymentStatus: kind === "PAYMENT" ? "VALID" : null,
      },
      customer:
        kind === "KITCHEN"
          ? null
          : {
              name: "Cliente de teste",
              phone: "11888888888",
              address: "Endereço de teste, 456",
              notes: "Nota da entrega de teste",
              payment: "Dinheiro",
              cashChange: "50,00",
            },
      items:
        kind === "PAYMENT"
          ? []
          : Array.from({ length: itemCount }, (_, index) => ({
              name: `Prato de teste ${index + 1} com feijão e pão`,
              quantity: 2,
              unitPrice: kind === "KITCHEN" ? null : 1234,
              total: kind === "KITCHEN" ? null : 2468,
              components: ["Arroz integral", "Salada de estação"],
              note: "Sem cebola",
            })),
      totals:
        kind === "KITCHEN" || kind === "PAYMENT"
          ? null
          : {
              subtotal: itemCount * 2468,
              discount: 100,
              deliveryFee: 500,
              total: itemCount * 2468 + 400,
              paid: 2000,
              outstanding: itemCount * 2468 - 1600,
            },
      payment:
        kind === "PAYMENT"
          ? {
              amount: 12345,
              method: "PIX",
              description: "Recebimento fictício para teste",
              createdAt: registeredAt,
              reversedAt: null,
              reversalReason: null,
            }
          : null,
      notes: kind === "KITCHEN" ? "" : "Observação geral de teste",
    },
  }
  return document
}

function prepare(document: ReceiptDocument) {
  const doc = new jsPDF({ unit: "mm", format: "a4", putOnlyUsedFonts: true })
  registerReceiptFonts(doc, fonts)
  return { doc, layout: createReceiptLayout(validatedReceiptDocument(document), doc) }
}

function pageText(layout: ReceiptLayout, index = 0): string {
  return layout.pages[index].drawings
    .flatMap((drawing) => (drawing.type === "text" ? [drawing.text] : []))
    .join(" ")
}

describe("receipt physical layout and vector output", () => {
  it.each(["generic-58", "generic-80", "a4", "custom"])(
    "paginates %s, preserving every item inside the physical printable area",
    (model) => {
      const input = fixture("ORDER", model, 40)
      if (model === "custom") {
        input.profile.paperWidthMm = 76
        input.profile.printableWidthMm = 64
      }
      const { doc, layout } = prepare(input)
      expect(layout.pages.length).toBeGreaterThan(1)
      expect(layout.width).toBe(input.profile.paperWidthMm)
      expect(layout.height).toBe(model === "a4" ? 297 : 280)
      const allText = layout.pages.map((_, index) => pageText(layout, index)).join(" ")
      for (let item = 1; item <= 40; item++)
        expect(allText).toContain(`Prato de teste ${item}`)
      for (const [index, page] of layout.pages.entries()) {
        const text = pageText(layout, index)
        expect(text).toContain("NÃO FISCAL")
        expect(text.replace(/ /g, "")).toContain(orderId)
        expect(text).toContain(`Página ${index + 1}/${layout.pages.length}`)
        for (const drawing of page.drawings) {
          expect(drawing.y).toBeGreaterThanOrEqual(0)
          expect(drawing.y).toBeLessThan(layout.height)
          if (drawing.type !== "text") continue
          doc.setFont(receiptFontName, drawing.bold ? "bold" : "normal")
          doc.setFontSize(drawing.fontSize)
          const textWidth = doc.getTextWidth(drawing.text)
          const left =
            drawing.x -
            (drawing.align === "right"
              ? textWidth
              : drawing.align === "center"
                ? textWidth / 2
                : 0)
          expect(left).toBeGreaterThanOrEqual(layout.contentX - 0.05)
          expect(left + textWidth).toBeLessThanOrEqual(
            layout.contentX + layout.contentWidth + 0.05,
          )
        }
      }
    },
  )

  it("embeds selectable Unicode text into an actual PDF, without rasterizing text", () => {
    const { doc, layout } = prepare(fixture())
    const pdf = drawReceiptPdf(doc, layout)
    const contents = doc.output()
    expect(pdf.type).toBe("application/pdf")
    expect(contents.startsWith("%PDF-")).toBe(true)
    expect(contents).toContain("/ToUnicode")
    expect(contents).toContain("/FontFile2")
    expect(contents).toContain("/Subtype /Type0")
    expect(contents).toContain(" Tj")
    expect(contents).not.toContain("/Subtype /Image")
    expect(doc.getNumberOfPages()).toBe(layout.pages.length)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(layout.width, 3)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(layout.height, 3)
    expect(pageText(layout)).toContain("feijão e pão")
    expect(pageText(layout)).toContain("R$ 12,34")
    expect(pageText(layout)).toContain("Desconto (-): R$ 1,00")
    expect(pageText(layout)).toContain("Recebimentos válidos registrados")
  })

  it("duplicates complete page sets for copies and labels each copy", () => {
    const input = fixture("ORDER", "generic-58", 8)
    const first = prepare(input).layout
    input.profile.copies = 3
    const { doc, layout } = prepare(input)
    expect(layout.pages).toHaveLength(first.pages.length * 3)
    for (let copy = 1; copy <= 3; copy++) {
      const offset = (copy - 1) * first.pages.length
      expect(layout.pages[offset].page).toBe(1)
      expect(pageText(layout, offset)).toContain(`Via ${copy}/3`)
      expect(pageText(layout, offset)).toContain(`Página 1/${first.pages.length}`)
    }
    drawReceiptPdf(doc, layout)
    expect(doc.getNumberOfPages()).toBe(first.pages.length * 3)
    const html = new DOMParser().parseFromString(
      receiptLayoutHtml(layout, fonts),
      "text/html",
    )
    expect(html.querySelectorAll(".receipt-page")).toHaveLength(first.pages.length * 3)
  })

  it("preserves reversal, identity, dates and nonfiscal notices outside editable sections", () => {
    const input = fixture("PAYMENT", "a4")
    input.template = { blocks: [{ type: "section", data: { section: "payment" } }] }
    input.snapshot.source.paymentStatus = "REVERSED"
    input.snapshot.payment!.reversedAt = "2026-10-25T12:30:00.000Z"
    input.snapshot.payment!.reversalReason = "Correção de lançamento duplicado"
    const text = pageText(prepare(input).layout)
    expect(text).toContain("NÃO FISCAL")
    expect(text).toContain(paymentId)
    expect(text).toContain("RECEBIMENTO REVERTIDO")
    expect(text).toContain("Valor original: R$ 123,45")
    expect(text).toContain("Reversão do registro; não comprova devolução ao cliente.")
    expect(text).toContain("Revertido: 25/10/2026, 09:30 (Brasília)")
    expect(text).toContain("Correção de lançamento duplicado")
    expect(text).toContain("Registrado: 25/10/2026, 09:00 (Brasília)")
    expect(text).toContain("Emitido: 25/10/2026, 10:00 (Brasília)")
    expect(text).not.toContain("ESTORNADO")
  })

  it("distinguishes a manual payment record from bank confirmation and cancellation from payment", () => {
    const payment = pageText(prepare(fixture("PAYMENT", "a4")).layout)
    expect(payment).toContain("Registro manual; não é confirmação bancária.")
    const cancelled = fixture("ORDER", "a4")
    cancelled.snapshot.source.status = "CANCELLED"
    cancelled.snapshot.totals!.outstanding = 0
    const text = pageText(prepare(cancelled).layout)
    expect(text).toContain("PEDIDO CANCELADO")
    expect(text).toContain("Pedido cancelado; saldo não cobrável.")
    expect(text).not.toContain("Saldo pendente: R$ 0,00")
  })

  it("keeps kitchen output free of customer and financial data and rejects a leaking snapshot", () => {
    const input = fixture("KITCHEN")
    input.template.blocks.push(
      { type: "section", data: { section: "customer" } },
      { type: "section", data: { section: "totals" } },
      { type: "section", data: { section: "payment" } },
    )
    const text = pageText(prepare(input).layout)
    expect(text).toContain("COZINHA")
    expect(text).toContain("Sem cebola")
    expect(text).not.toContain("Cliente de teste")
    expect(text).not.toContain("R$")
    input.snapshot.items[0].unitPrice = 1234
    expect(() => validatedReceiptDocument(input)).toThrow()
  })

  it("escapes server data in self-contained HTML and shows unsupported symbols explicitly", () => {
    const input = fixture("ORDER", "a4")
    input.snapshot.items[0].name = 'Pão <img src=x onerror="alert(1)"> & 🍔'
    const { layout } = prepare(input)
    const html = receiptLayoutHtml(layout, fonts)
    const parsed = new DOMParser().parseFromString(html, "text/html")
    expect(parsed.querySelectorAll("script,img,iframe,object,embed,a,link")).toHaveLength(
      0,
    )
    expect(parsed.querySelector("main")?.textContent).toContain(
      '<img src=x onerror="alert(1)">',
    )
    expect(parsed.querySelector("main")?.textContent).toContain("[U+1F354]")
    expect(layout.warnings).toHaveLength(1)
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("@page{size:210mm 297mm")
    expect(html).toContain("data:font/ttf;base64,")
  })

  it("rejects missing/duplicate mandatory sections and invalid profile without fetching fonts", async () => {
    const input = fixture()
    input.template.blocks = [{ type: "text", data: { text: "Olá", align: "left" } }]
    expect(() => validatedReceiptDocument(input)).toThrow("obrigatórias")
    input.template = defaultPrintingSettings().templates.ORDER
    input.template.blocks.push({ type: "section", data: { section: "items" } })
    expect(() => validatedReceiptDocument(input)).toThrow("repetições")
    input.profile.printableWidthMm = 100
    const logger = { record: vi.fn() }
    const renderer = new BrowserReceiptOutputRenderer(
      new Executor(logger, { next: () => "diagnostic-test" }),
    )
    const result = await renderer.create(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION")
    expect(JSON.stringify(logger.record.mock.calls)).not.toContain("Cliente de teste")
  })

  it("accepts inline PNG dimensions and rejects remote, SVG, malformed and oversized logos", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X2kAAAAASUVORK5CYII="
    expect(receiptLogoSize(png)).toEqual({ width: 1, height: 1 })
    for (const invalid of [
      "https://example.org/logo.png",
      "data:image/svg+xml,<svg/>",
      "data:image/png;base64,iVBORw0KGgoAAAAA",
    ])
      expect(() => receiptLogoSize(invalid)).toThrow()
    const bytes = Buffer.from(png.split(",")[1], "base64")
    bytes.writeUInt32BE(4096, 16)
    expect(() =>
      receiptLogoSize(`data:image/png;base64,${bytes.toString("base64")}`),
    ).toThrow()
  })
})

describe("researched printer presets", () => {
  it("uses valid geometry, explicit sources and no cutter commands by default", () => {
    expect(new Set(printerModels.map((model) => model.id)).size).toBe(
      printerModels.length,
    )
    for (const model of printerModels) {
      expect(
        printerProfileSchema.safeParse(presetProfile(model.id, "test")).success,
      ).toBe(true)
      expect(model.sourceUrl).toMatch(/^https:\/\//)
      expect(model.settings.cut).toBe("NONE")
    }
    expect(
      printerModels.filter((model) => model.id.startsWith("epson-tm-t20x")),
    ).toHaveLength(1)
    expect(presetProfile("epson-tm-t20x", "test").paperWidthMm).toBe(80)
    expect(presetProfile("epson-tm-t20iii-58", "test").printableWidthMm).toBe(52.5)
    expect(presetProfile("generic-58", "test").printableWidthMm).toBe(48)
    expect(presetProfile("generic-80", "test").printableWidthMm).toBe(72)
  })

  it("returns isolated presets and rejects unknown model ids", () => {
    const first = presetProfile("generic-58", "first", "Minha impressora")
    first.printableWidthMm = 40
    expect(first.name).toBe("Minha impressora")
    expect(presetProfile("generic-58", "second").printableWidthMm).toBe(48)
    expect(() => presetProfile("invented", "test")).toThrow()
  })
})

describe("ESC/POS file protocol without printer access", () => {
  const blankRaster = async (width: number, height: number) =>
    ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255),
      colorSpace: "srgb",
    }) as ImageData

  it("keeps useful widths within the printhead, including fractional Epson width", () => {
    for (const [model, expected] of [
      ["generic-58", 384],
      ["generic-80", 576],
      ["epson-tm-t20iii-58", 416],
    ] as const) {
      const input = fixture("ORDER", model)
      const layout = {
        contentWidth: input.profile.printableWidthMm,
        height: 60,
      } as ReceiptLayout
      expect(receiptRasterSize(input.profile, layout).width).toBe(expected)
    }
  })

  it.each(["NONE", "PARTIAL", "FULL"] as const)(
    "encodes actual raster commands and applies %s cut only at copy boundaries",
    async (cut) => {
      const profile = { ...presetProfile("generic-58", "test"), cut, feedLines: 0 }
      const layout: ReceiptLayout = {
        width: 58,
        contentWidth: 48,
        contentX: 5,
        height: 60,
        title: "Teste",
        filename: "test.pdf",
        warnings: [],
        pages: [
          { copy: 1, page: 1, drawings: [] },
          { copy: 1, page: 2, drawings: [] },
          { copy: 2, page: 1, drawings: [] },
        ],
      }
      const bytes = await encodeReceiptRasterPages(profile, layout, () =>
        blankRaster(384, 480),
      )
      expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40])
      const commands = Array.from(bytes).flatMap((byte, index) =>
        byte === 0x1d && bytes[index + 1] === 0x56 ? [bytes[index + 2]] : [],
      )
      expect(commands).toEqual(cut === "NONE" ? [] : cut === "PARTIAL" ? [1, 1] : [0, 0])
      expect(
        Array.from(bytes).some(
          (byte, index) =>
            byte === 0x1d && bytes[index + 1] === 0x76 && bytes[index + 2] === 0x30,
        ),
      ).toBe(true)
      expect(
        Array.from(bytes).some(
          (byte, index) => byte === 0x1b && bytes[index + 1] === 0x70,
        ),
      ).toBe(false)
    },
  )
})
