import {
  receiptDocumentSchema,
  type ReceiptDocument,
  type ReceiptSnapshot,
} from "@cardapio/contracts"
import { requiredReceiptSections, type ReceiptSection } from "@cardapio/domain/printing"
import type { jsPDF } from "jspdf"
import { Failure } from "../../../shared/domain/failure"
import { receiptFontName } from "./receipt-fonts"

export type ReceiptDrawing =
  | {
      type: "text"
      text: string
      x: number
      y: number
      fontSize: number
      bold: boolean
      align: "left" | "center" | "right"
    }
  | { type: "line"; x: number; y: number; width: number }
  | { type: "logo"; data: string; x: number; y: number; width: number; height: number }

export interface ReceiptPage {
  drawings: ReceiptDrawing[]
  copy: number
  page: number
}
export interface ReceiptLayout {
  width: number
  height: number
  contentX: number
  contentWidth: number
  pages: ReceiptPage[]
  title: string
  filename: string
  warnings: string[]
}
type FlowDrawing = { drawing: ReceiptDrawing; height: number }

const millimetersPerPoint = 25.4 / 72
const money = (amount: number) =>
  (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value)) + " (Brasília)"
const kindNames = {
  ORDER: "PEDIDO",
  KITCHEN: "COZINHA",
  DELIVERY: "ENTREGA",
  PAYMENT: "RECEBIMENTO MANUAL",
} as const
const statusNames = {
  NEW: "Novo",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Em entrega",
  COMPLETED: "Concluído",
  CANCELLED: "PEDIDO CANCELADO",
} as const
const methodNames = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  OTHER: "Outro",
} as const

export function validatedReceiptDocument(input: ReceiptDocument): ReceiptDocument {
  const parsed = receiptDocumentSchema.safeParse(input)
  if (!parsed.success)
    throw new Failure(
      "VALIDATION",
      "O documento ou as configurações de impressão são inválidos. Recarregue os dados e confira o perfil.",
    )
  const { snapshot, template } = parsed.data
  if (
    snapshot.kind === "PAYMENT"
      ? !snapshot.payment || !snapshot.source.paymentId
      : !snapshot.source.orderId
  ) {
    throw new Failure(
      "VALIDATION",
      "O comprovante não possui um registro de origem válido.",
    )
  }
  const sections = template.blocks
    .filter((block) => block.type === "section")
    .map((block) => block.data.section)
  if (
    new Set(sections).size !== sections.length ||
    requiredReceiptSections[snapshot.kind].some((section) => !sections.includes(section))
  ) {
    throw new Failure(
      "VALIDATION",
      "O modelo precisa manter as seções obrigatórias, sem repetições.",
    )
  }
  return parsed.data
}

export function receiptLogoSize(data: string): { width: number; height: number } {
  try {
    if (
      !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(data) ||
      data.length > 200_000
    )
      throw new Error("invalid")
    const raw = atob(data.slice(data.indexOf(",") + 1))
    const bytes = Uint8Array.from(raw, (value) => value.charCodeAt(0))
    if (bytes.length < 33 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR")
      throw new Error("invalid")
    const view = new DataView(bytes.buffer)
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    if (
      width < 1 ||
      height < 1 ||
      width > 2048 ||
      height > 2048 ||
      width * height > 4_000_000
    )
      throw new Error("invalid")
    return { width, height }
  } catch {
    throw new Failure(
      "VALIDATION",
      "A logo precisa ser um PNG válido de até 2048 × 2048 pixels. Selecione a imagem novamente.",
    )
  }
}

export function createReceiptLayout(
  input: ReceiptDocument,
  measure: jsPDF,
): ReceiptLayout {
  const { snapshot, profile, template } = input
  const width = profile.paperWidthMm
  const contentWidth = profile.printableWidthMm
  const contentX = (width - contentWidth) / 2
  const top = Math.max(3, profile.marginMm)
  const fontSize = profile.fontSize
  const warningSet = new Set<string>()
  const font = measure.getFont().metadata as {
    cmap?: { unicode?: { codeMap?: Record<number, number> } }
  }
  const supported = font.cmap?.unicode?.codeMap
  const readable = (value: string): string =>
    Array.from(
      value
        .normalize("NFC")
        .replace(/\u00a0/g, " ")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " "),
    )
      .map((character) => {
        if (/\s/u.test(character) || !supported || supported[character.codePointAt(0)!])
          return character
        warningSet.add(
          "Símbolos ausentes na fonte são mostrados por seu código Unicode, como [U+1F354], em todas as saídas.",
        )
        return `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`
      })
      .join("")
  const text = (
    target: FlowDrawing[],
    value: string,
    options: {
      bold?: boolean
      align?: "left" | "center" | "right"
      size?: number
      indent?: number
    } = {},
  ) => {
    const size = options.size ?? fontSize
    const indent = options.indent ?? 0
    const align = options.align ?? "left"
    const lineHeight = size * millimetersPerPoint * 1.4
    measure.setFont(receiptFontName, options.bold ? "bold" : "normal")
    measure.setFontSize(size)
    const lines = measure.splitTextToSize(
      readable(value),
      contentWidth - indent,
    ) as string[]
    for (const line of lines) {
      target.push({
        height: lineHeight,
        drawing: {
          type: "text",
          text: line,
          x:
            align === "center"
              ? width / 2
              : align === "right"
                ? contentX + contentWidth
                : contentX + indent,
          y: size * millimetersPerPoint * 1.04,
          fontSize: size,
          bold: options.bold ?? false,
          align,
        },
      })
    }
  }
  const gap = (target: FlowDrawing[], height = 1.5) =>
    target.push({
      height,
      drawing: {
        type: "text",
        text: "",
        x: contentX,
        y: 0,
        fontSize,
        bold: false,
        align: "left",
      },
    })
  const divider = (target: FlowDrawing[]) =>
    target.push({
      height: 3,
      drawing: { type: "line", x: contentX, y: 1.5, width: contentWidth },
    })
  const title = `${kindNames[snapshot.kind]} — NÃO FISCAL`
  const core: FlowDrawing[] = []
  text(core, "NÃO FISCAL", { bold: true, align: "center", size: fontSize + 2 })
  text(core, kindNames[snapshot.kind], { bold: true, align: "center" })
  text(core, snapshot.restaurant.name, { bold: true, align: "center" })
  const small = Math.max(8, fontSize - 2)
  if (snapshot.source.orderId)
    text(core, `Pedido: ${snapshot.source.orderId}`, { size: small })
  if (snapshot.source.paymentId)
    text(core, `Recebimento: ${snapshot.source.paymentId}`, { size: small })
  text(core, `Registrado: ${date(snapshot.source.createdAt)}`, { size: small })
  text(core, `Emitido: ${date(snapshot.generatedAt)}`, { size: small })
  if (snapshot.source.status)
    text(core, `Situação do pedido: ${statusNames[snapshot.source.status]}`, {
      bold: true,
    })
  if (snapshot.source.status === "CANCELLED")
    text(core, "Pedido cancelado; saldo não cobrável.", { bold: true, size: small })
  if (snapshot.kind === "PAYMENT" && snapshot.payment) {
    const reversed =
      snapshot.source.paymentStatus === "REVERSED" || snapshot.payment.reversedAt !== null
    text(
      core,
      reversed ? "RECEBIMENTO REVERTIDO" : "RECEBIMENTO REGISTRADO MANUALMENTE",
      { bold: true },
    )
    text(
      core,
      `${reversed ? "Valor original" : "Valor registrado"}: ${money(snapshot.payment.amount)}`,
      { bold: true },
    )
    text(core, `Forma: ${methodNames[snapshot.payment.method]}`)
    text(
      core,
      reversed
        ? "Reversão do registro; não comprova devolução ao cliente."
        : "Registro manual; não é confirmação bancária.",
      { size: small },
    )
    if (snapshot.payment.reversedAt)
      text(core, `Revertido: ${date(snapshot.payment.reversedAt)}`, { size: small })
    if (snapshot.payment.reversalReason)
      text(core, `Motivo: ${snapshot.payment.reversalReason}`, { size: small })
  }
  divider(core)

  const body: FlowDrawing[] = []
  const heading = (value: string) => {
    gap(body)
    text(body, value, { bold: true })
  }
  const renderSection = (section: ReceiptSection) => {
    switch (section) {
      case "store":
        if (snapshot.restaurant.address) text(body, snapshot.restaurant.address)
        if (snapshot.restaurant.phone)
          text(body, `Contato da loja: ${snapshot.restaurant.phone}`)
        break
      case "customer":
        if (snapshot.kind === "KITCHEN" || !snapshot.customer) break
        heading(snapshot.kind === "DELIVERY" ? "CLIENTE / ENTREGA" : "CLIENTE")
        text(body, snapshot.customer.name)
        if (snapshot.customer.phone) text(body, `Telefone: ${snapshot.customer.phone}`)
        if (snapshot.customer.address)
          text(body, `Endereço: ${snapshot.customer.address}`)
        if (snapshot.customer.payment)
          text(body, `Forma informada no pedido: ${snapshot.customer.payment}`)
        if (snapshot.customer.cashChange)
          text(body, `Troco solicitado: ${snapshot.customer.cashChange}`)
        break
      case "items":
        heading("ITENS")
        for (const item of snapshot.items) {
          text(body, `${item.quantity} × ${item.name}`, { bold: true })
          if (
            snapshot.kind !== "KITCHEN" &&
            item.unitPrice !== null &&
            item.total !== null
          )
            text(body, `${money(item.unitPrice)} cada · ${money(item.total)}`, {
              align: "right",
            })
          for (const component of item.components)
            text(body, `+ ${component}`, { indent: 2 })
          if (item.note) text(body, `Observação: ${item.note}`, { indent: 2 })
          gap(body)
        }
        break
      case "totals":
        if (snapshot.kind === "KITCHEN" || !snapshot.totals) break
        heading("VALORES DO PEDIDO")
        for (const [label, amount] of [
          ["Subtotal", snapshot.totals.subtotal],
          ["Desconto (-)", snapshot.totals.discount],
          ["Entrega", snapshot.totals.deliveryFee],
        ] as const)
          text(body, `${label}: ${money(amount)}`)
        text(body, `Total: ${money(snapshot.totals.total)}`, { bold: true })
        text(body, `Recebimentos válidos registrados: ${money(snapshot.totals.paid)}`)
        text(
          body,
          snapshot.source.status === "CANCELLED"
            ? "Pedido cancelado; saldo não cobrável."
            : `Saldo pendente: ${money(snapshot.totals.outstanding)}`,
          { bold: true },
        )
        break
      case "payment":
        if (snapshot.kind === "KITCHEN" || !snapshot.payment) break
        heading("DETALHES DO RECEBIMENTO")
        if (snapshot.payment.description) text(body, snapshot.payment.description)
        text(body, `Registrado em: ${date(snapshot.payment.createdAt)}`)
        if (snapshot.kind !== "PAYMENT") {
          text(body, `Valor: ${money(snapshot.payment.amount)}`)
          text(body, `Forma: ${methodNames[snapshot.payment.method]}`)
          text(
            body,
            snapshot.payment.reversedAt ? "RECEBIMENTO REVERTIDO" : "Registro manual",
            { bold: true },
          )
        }
        break
      case "notes": {
        const notes = [
          ...new Set(
            [
              snapshot.notes,
              snapshot.kind !== "KITCHEN" ? snapshot.customer?.notes : "",
            ].filter(Boolean),
          ),
        ]
        if (notes.length) {
          heading("OBSERVAÇÕES")
          for (const note of notes) text(body, note!)
        }
        break
      }
    }
  }
  for (const block of template.blocks) {
    if (block.type === "text") {
      text(body, block.data.text, { align: block.data.align })
      gap(body)
    }
    if (block.type === "divider") divider(body)
    if (block.type === "section") {
      renderSection(block.data.section)
      gap(body)
    }
    if (block.type === "logo" && snapshot.restaurant.logo) {
      const dimensions = receiptLogoSize(snapshot.restaurant.logo)
      const maxWidth = Math.min(
        contentWidth,
        { small: 18, medium: 28, large: 40 }[block.data.size],
      )
      const maxHeight = { small: 12, medium: 18, large: 26 }[block.data.size]
      const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height)
      const logoWidth = dimensions.width * scale
      const logoHeight = dimensions.height * scale
      body.push({
        height: logoHeight + 2,
        drawing: {
          type: "logo",
          data: snapshot.restaurant.logo,
          x: (width - logoWidth) / 2,
          y: 0,
          width: logoWidth,
          height: logoHeight,
        },
      })
    }
  }
  const coreHeight = core.reduce((sum, row) => sum + row.height, 0)
  const footerHeight = 12
  const naturalHeight =
    top + coreHeight + body.reduce((sum, row) => sum + row.height, 0) + footerHeight + top
  const height =
    width >= 148 ? 297 : Math.min(280, Math.max(60, Math.ceil(naturalHeight)))
  const contentBottom = height - top - footerHeight
  if (coreHeight + top > contentBottom - 15)
    throw new Failure(
      "VALIDATION",
      "A fonte ou o cabeçalho está grande demais para este papel. Reduza a fonte ou escolha papel mais largo.",
    )
  const pages: ReceiptPage[] = []
  const shifted = (drawing: ReceiptDrawing, y: number): ReceiptDrawing => ({
    ...drawing,
    y: drawing.y + y,
  })
  const newPage = () => {
    const page: ReceiptPage = { drawings: [], copy: 1, page: pages.length + 1 }
    let y = top
    for (const row of core) {
      page.drawings.push(shifted(row.drawing, y))
      y += row.height
    }
    pages.push(page)
    if (pages.length * profile.copies > 100)
      throw new Failure(
        "VALIDATION",
        "O comprovante excede 100 páginas. Reduza a fonte, as vias ou o conteúdo do modelo.",
      )
    return { page, y }
  }
  let current = newPage()
  for (const row of body) {
    if (current.y + row.height > contentBottom) current = newPage()
    current.page.drawings.push(shifted(row.drawing, current.y))
    current.y += row.height
  }
  const sourceId = snapshot.source.paymentId ?? snapshot.source.orderId!
  const allPages: ReceiptPage[] = []
  for (let copy = 1; copy <= profile.copies; copy++) {
    for (const page of pages)
      allPages.push({
        ...page,
        copy,
        drawings: [
          ...page.drawings,
          { type: "line", x: contentX, y: contentBottom + 2, width: contentWidth },
          {
            type: "text",
            x: width / 2,
            y: contentBottom + 6,
            text: "NÃO FISCAL · Via " + copy + "/" + profile.copies,
            fontSize: 8,
            bold: false,
            align: "center",
          },
          {
            type: "text",
            x: width / 2,
            y: contentBottom + 10,
            text: "Página " + page.page + "/" + pages.length,
            fontSize: 8,
            bold: false,
            align: "center",
          },
        ],
      })
  }
  return {
    width,
    height,
    contentX,
    contentWidth,
    pages: allPages,
    title,
    filename: `comprovante-${snapshot.kind.toLowerCase()}-${sourceId}.pdf`,
    warnings: [...warningSet],
  }
}

export function receiptSourceSummary(snapshot: ReceiptSnapshot): string {
  return `${kindNames[snapshot.kind]} — NÃO FISCAL — ${snapshot.source.paymentId ?? snapshot.source.orderId}`
}
