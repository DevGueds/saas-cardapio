import type { OutputData } from "@editorjs/editorjs"
import {
  receiptTemplateSchema,
  type ReceiptKind,
  type ReceiptTemplate,
} from "@cardapio/contracts"
import { requiredReceiptSections } from "@cardapio/domain/printing"
import { receiptSectionLabels } from "./receipt-editor-tools"

export function validateReceiptEditorData(
  output: OutputData,
  kind: ReceiptKind,
): { ok: true; template: ReceiptTemplate } | { ok: false; message: string } {
  const result = receiptTemplateSchema.safeParse({
    blocks: output.blocks.map(({ type, data }) => ({ type, data })),
  })
  if (!result.success)
    return {
      ok: false,
      message:
        "Revise os blocos: use até 32 blocos e textos de até 500 caracteres, sem HTML ou caracteres de controle.",
    }
  const sections = result.data.blocks.flatMap((block) =>
    block.type === "section" ? [block.data.section] : [],
  )
  if (new Set(sections).size !== sections.length)
    return {
      ok: false,
      message:
        "Cada seção automática deve aparecer apenas uma vez. Remova a seção repetida.",
    }
  const missing = requiredReceiptSections[kind].filter(
    (section) => !sections.includes(section),
  )
  if (missing.length)
    return {
      ok: false,
      message: `Adicione as seções obrigatórias: ${missing.map((section) => receiptSectionLabels[section]).join(", ")}.`,
    }
  return { ok: true, template: result.data }
}
