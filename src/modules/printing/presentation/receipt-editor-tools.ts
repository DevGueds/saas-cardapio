import type {
  API,
  BlockAPI,
  BlockToolConstructorOptions,
  EditorConfig,
  OutputData,
} from "@editorjs/editorjs"
import type { ReceiptBlock, ReceiptSection } from "@cardapio/contracts"

export const receiptSectionLabels: Record<ReceiptSection, string> = {
  store: "Dados da loja",
  customer: "Cliente e entrega",
  items: "Itens do pedido",
  totals: "Valores e totais",
  payment: "Dados do pagamento",
  notes: "Observações",
}

function labelControl(label: string, control: HTMLElement) {
  const field = document.createElement("label")
  field.className = "field"
  const caption = document.createElement("span")
  caption.textContent = label
  field.append(caption, control)
  return field
}

function selectControl(options: Record<string, string>, value: string) {
  const select = document.createElement("select")
  for (const [key, label] of Object.entries(options)) {
    const option = document.createElement("option")
    option.value = key
    option.textContent = label
    select.append(option)
  }
  select.value = value
  return select
}

/** Only native controls and text nodes receive user data. No HTML tool is registered. */
export function createReceiptTools(onEdit: () => void) {
  const readers = new Map<string, () => ReceiptBlock>()

  abstract class ReceiptTool {
    static get isReadOnlySupported() {
      return true
    }
    static get enableLineBreaks() {
      return true
    }
    static get pasteConfig() {
      return { tags: [], patterns: {}, files: { extensions: [], mimeTypes: [] } }
    }
    // Preserve the plain input for schema validation; never silently remove bad text.
    static get sanitize() {
      return { text: true }
    }
    readonly api: API
    readonly block: BlockAPI
    readonly data: Record<string, unknown>
    readonly root = document.createElement("div")
    abstract readonly type: ReceiptBlock["type"]
    abstract save(): ReceiptBlock["data"]

    constructor({ api, block, data }: BlockToolConstructorOptions) {
      this.api = api
      this.block = block
      this.data = data
      this.root.className = "receipt-editor-block"
      readers.set(
        block.id,
        () => ({ type: this.type, data: this.save() }) as ReceiptBlock,
      )
      // Editor.js handles contenteditable keys; our native controls own their keys.
      this.root.addEventListener("keydown", (event) => event.stopPropagation())
      this.root.addEventListener("paste", (event) => event.stopPropagation())
      this.root.addEventListener("drop", (event) => event.stopPropagation())
    }

    changed = () => {
      this.block.dispatchChange()
      onEdit()
    }

    renderBlock(title: string, ...controls: HTMLElement[]) {
      const heading = document.createElement("strong")
      heading.textContent = title
      const actions = document.createElement("div")
      actions.className = "receipt-editor-block-actions"
      const position = () => this.api.blocks.getBlockIndex(this.block.id)
      const button = (text: string, action: () => void) => {
        const element = document.createElement("button")
        element.type = "button"
        element.className = "secondary-button"
        element.textContent = text
        element.setAttribute("aria-label", `${text}: ${title}`)
        element.addEventListener("click", () => {
          action()
          this.changed()
        })
        actions.append(element)
      }
      button("Subir", () => {
        const index = position()
        if (index > 0) this.api.blocks.move(index - 1, index)
      })
      button("Descer", () => {
        const index = position()
        if (index >= 0 && index < this.api.blocks.getBlocksCount() - 1)
          this.api.blocks.move(index + 1, index)
      })
      button("Remover", () => {
        const index = position()
        if (index < 0) return
        this.api.blocks.delete(index)
        const next = this.api.blocks.getBlockByIndex(Math.max(0, index - 1))
        next?.holder.querySelector<HTMLElement>("textarea, select, button")?.focus()
      })
      this.root.append(heading, ...controls, actions)
      return this.root
    }

    // Returning false here makes Editor.js omit a block. The shared schema handles
    // validation after saving so an invalid draft stays available for correction.
    validate() {
      return true
    }
    destroy() {
      readers.delete(this.block.id)
    }
  }

  class ReceiptTextTool extends ReceiptTool {
    readonly type = "text" as const
    private text = document.createElement("textarea")
    private align = selectControl(
      { left: "À esquerda", center: "Centralizado", right: "À direita" },
      String(this.data.align ?? "left"),
    )
    render() {
      this.text.rows = 3
      this.text.maxLength = 500
      this.text.value = typeof this.data.text === "string" ? this.data.text : ""
      this.text.addEventListener("input", this.changed)
      this.align.addEventListener("change", this.changed)
      return this.renderBlock(
        "Texto livre",
        labelControl("Texto (até 500 caracteres)", this.text),
        labelControl("Alinhamento", this.align),
      )
    }
    save() {
      return {
        text: this.text.value,
        align: this.align.value as "left" | "center" | "right",
      }
    }
  }

  class ReceiptLogoTool extends ReceiptTool {
    readonly type = "logo" as const
    private size = selectControl(
      { small: "Pequeno", medium: "Médio", large: "Grande" },
      String(this.data.size ?? "medium"),
    )
    render() {
      const help = document.createElement("p")
      help.className = "field-help"
      help.textContent = "O logo enviado abaixo aparecerá nesta posição do comprovante."
      this.size.addEventListener("change", this.changed)
      return this.renderBlock(
        "Logo da loja",
        help,
        labelControl("Tamanho do logo", this.size),
      )
    }
    save() {
      return { size: this.size.value as "small" | "medium" | "large" }
    }
  }

  class ReceiptSectionTool extends ReceiptTool {
    readonly type = "section" as const
    private section = selectControl(
      receiptSectionLabels,
      String(this.data.section ?? "store"),
    )
    render() {
      const help = document.createElement("p")
      help.className = "field-help"
      help.textContent =
        "Os dados reais do pedido ou pagamento serão preenchidos ao imprimir."
      this.section.addEventListener("change", this.changed)
      return this.renderBlock(
        "Seção automática",
        labelControl("Conteúdo da seção", this.section),
        help,
      )
    }
    save() {
      return { section: this.section.value as ReceiptSection }
    }
  }

  class ReceiptDividerTool extends ReceiptTool {
    readonly type = "divider" as const
    render() {
      return this.renderBlock("Linha divisória", document.createElement("hr"))
    }
    save() {
      return {}
    }
  }

  return {
    tools: {
      text: { class: ReceiptTextTool, inlineToolbar: false, toolbox: false },
      logo: { class: ReceiptLogoTool, inlineToolbar: false, toolbox: false },
      section: { class: ReceiptSectionTool, inlineToolbar: false, toolbox: false },
      divider: { class: ReceiptDividerTool, inlineToolbar: false, toolbox: false },
      // Override Editor.js's built-in paragraph to prevent its HTML editor being used.
      paragraph: { class: ReceiptTextTool, inlineToolbar: false, toolbox: false },
    } satisfies EditorConfig["tools"],
    snapshot(api: Pick<API, "blocks">): OutputData {
      const blocks = []
      for (let index = 0; index < api.blocks.getBlocksCount(); index++) {
        const block = api.blocks.getBlockByIndex(index)
        const read = block && readers.get(block.id)
        if (!block || !read) throw new Error("Não foi possível ler todos os blocos.")
        blocks.push({ id: block.id, ...read() })
      }
      return { blocks }
    },
  }
}
