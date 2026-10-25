import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import type {
  API,
  BlockAPI,
  BlockTool,
  BlockToolConstructable,
  EditorConfig,
  OutputData,
} from "@editorjs/editorjs"
import type { ReceiptTemplate } from "@cardapio/contracts"
import ReceiptLayoutEditor from "../src/modules/printing/presentation/ReceiptLayoutEditor"
import { validateReceiptEditorData } from "../src/modules/printing/presentation/receipt-editor-data"
import { normalizeReceiptLogo } from "../src/modules/printing/presentation/receipt-editor-logo"

const editor = vi.hoisted(() => ({
  instances: [] as Array<{
    destroy: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    options: EditorConfig
  }>,
  nextSave: undefined as undefined | ((output: OutputData) => Promise<OutputData>),
}))

vi.mock("@editorjs/editorjs", () => ({
  default: class {
    options: EditorConfig
    isReady = Promise.resolve()
    rows: Array<{ type: string; api: BlockAPI; tool: BlockTool }> = []
    sequence = 0
    blocks = {
      getBlocksCount: () => this.rows.length,
      getBlockByIndex: (index: number) => this.rows[index]?.api,
      getBlockIndex: (id: string) => this.rows.findIndex((row) => row.api.id === id),
      insert: (
        type: string,
        data: Record<string, unknown>,
        _config?: unknown,
        index = this.rows.length,
      ) => {
        const definition = this.options.tools![type] as { class: BlockToolConstructable }
        const holder = document.createElement("div")
        const api = {
          id: `block-${++this.sequence}`,
          name: type,
          holder,
          dispatchChange: vi.fn(),
        } as unknown as BlockAPI
        const tool = new definition.class({
          data,
          block: api,
          api: { blocks: this.blocks } as unknown as API,
          readOnly: false,
          config: {},
        })
        const content = tool.render()
        if (!(content instanceof HTMLElement))
          throw new Error("Expected a synchronous tool")
        holder.append(content)
        this.rows.splice(index, 0, { type, api, tool })
        this.reorder()
        return api
      },
      delete: (index: number) => {
        const [row] = this.rows.splice(index, 1)
        row?.tool.destroy?.()
        row?.api.holder.remove()
      },
      move: (to: number, from: number) => {
        const [row] = this.rows.splice(from, 1)
        this.rows.splice(to, 0, row!)
        this.reorder()
      },
      render: async (output: OutputData) => {
        this.rows.forEach((row) => {
          row.tool.destroy?.()
          row.api.holder.remove()
        })
        this.rows = []
        for (const block of output.blocks) this.blocks.insert(block.type, block.data)
      },
    }
    reorder() {
      ;(this.options.holder as HTMLElement).replaceChildren(
        ...this.rows.map((row) => row.api.holder),
      )
    }
    save = vi.fn(async () => {
      const output = {
        blocks: await Promise.all(
          this.rows.map(async (row) => ({
            id: row.api.id,
            type: row.type,
            data: await row.tool.save(row.api.holder),
          })),
        ),
      }
      return editor.nextSave ? editor.nextSave(output) : output
    })
    destroy = vi.fn(() => {
      this.rows.forEach((row) => {
        row.tool.destroy?.()
        row.api.holder.remove()
      })
      this.rows = []
    })
    constructor(options: EditorConfig) {
      this.options = options
      editor.instances.push(this)
      void this.blocks.render(options.data!)
    }
  },
}))

const template: ReceiptTemplate = {
  blocks: [
    { type: "section", data: { section: "items" } },
    { type: "text", data: { text: "Obrigado", align: "center" } },
  ],
}

beforeEach(() => {
  editor.instances.length = 0
  editor.nextSave = undefined
})

it("keeps HTML as literal editable text, rejects it, and uses the latest callback without recreating the editor", async () => {
  const oldChange = vi.fn(),
    latestChange = vi.fn(),
    validity = vi.fn()
  const props = {
    template,
    kind: "KITCHEN" as const,
    logo: "",
    onLogoChange: vi.fn(),
    onValidityChange: validity,
  }
  const view = render(<ReceiptLayoutEditor {...props} onChange={oldChange} />)
  const text = await screen.findByLabelText("Texto (até 500 caracteres)")
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Adicionar bloco" })).toBeEnabled(),
  )
  const attack = '<img src=x onerror="window.hacked=true">'
  fireEvent.input(text, { target: { value: attack } })
  await screen.findByText(/Revise os blocos/)
  expect(text).toHaveValue(attack)
  expect(view.container.querySelector("img")).toBeNull()
  expect(oldChange).not.toHaveBeenCalled()
  expect(validity).toHaveBeenLastCalledWith(false)
  view.rerender(<ReceiptLayoutEditor {...props} onChange={latestChange} />)
  fireEvent.input(text, { target: { value: "Volte sempre" } })
  await waitFor(() =>
    expect(latestChange).toHaveBeenCalledWith({
      blocks: [
        template.blocks[0],
        { type: "text", data: { text: "Volte sempre", align: "center" } },
      ],
    }),
  )
  expect(oldChange).not.toHaveBeenCalled()
  expect(editor.instances).toHaveLength(1)
  expect(validity).toHaveBeenLastCalledWith(true)
})

it("preserves the current draft on save failure and ignores a late result after unmount", async () => {
  const onChange = vi.fn()
  const props = {
    template,
    kind: "KITCHEN" as const,
    logo: "",
    onLogoChange: vi.fn(),
    onChange,
  }
  const view = render(<ReceiptLayoutEditor {...props} />)
  const text = await screen.findByLabelText("Texto (até 500 caracteres)")
  editor.nextSave = () => Promise.reject(new Error("save failed"))
  fireEvent.input(text, { target: { value: "Rascunho preservado" } })
  await screen.findByRole("button", { name: "Reabrir editor" })
  editor.nextSave = undefined
  await userEvent.click(screen.getByRole("button", { name: "Reabrir editor" }))
  await waitFor(() =>
    expect(screen.getByLabelText("Texto (até 500 caracteres)")).toHaveValue(
      "Rascunho preservado",
    ),
  )
  expect(editor.instances[0]!.destroy).toHaveBeenCalledOnce()
  await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  onChange.mockClear()
  let resolve!: (data: OutputData) => void
  let saved!: OutputData
  editor.nextSave = (output) => {
    saved = output
    return new Promise((done) => {
      resolve = done
    })
  }
  fireEvent.input(screen.getByLabelText("Texto (até 500 caracteres)"), {
    target: { value: "Não publicar depois de sair" },
  })
  await waitFor(() => expect(resolve).toBeTypeOf("function"))
  view.unmount()
  await act(async () => resolve(saved))
  expect(onChange).not.toHaveBeenCalled()
  expect(editor.instances[1]!.destroy).toHaveBeenCalledOnce()
})

it("rejects a save that omits a visible block and reopens with all draft blocks", async () => {
  const onChange = vi.fn()
  render(
    <ReceiptLayoutEditor
      template={template}
      kind="KITCHEN"
      logo=""
      onLogoChange={vi.fn()}
      onChange={onChange}
    />,
  )
  const text = await screen.findByLabelText("Texto (até 500 caracteres)")
  editor.nextSave = async (output) => ({ blocks: output.blocks.slice(0, 1) })
  fireEvent.input(text, { target: { value: "Não perder este texto" } })
  await screen.findByRole("button", { name: "Reabrir editor" })
  expect(onChange).not.toHaveBeenCalled()
  expect(text).toHaveValue("Não perder este texto")
  editor.nextSave = undefined
  await userEvent.click(screen.getByRole("button", { name: "Reabrir editor" }))
  await waitFor(() =>
    expect(screen.getByLabelText("Texto (até 500 caracteres)")).toHaveValue(
      "Não perder este texto",
    ),
  )
  expect(screen.getByLabelText("Conteúdo da seção")).toHaveValue("items")
})

it("supports keyboard-operable movement and reports missing required sections without publishing them", async () => {
  const onChange = vi.fn(),
    validity = vi.fn()
  render(
    <ReceiptLayoutEditor
      template={template}
      kind="KITCHEN"
      logo=""
      onLogoChange={vi.fn()}
      onChange={onChange}
      onValidityChange={validity}
    />,
  )
  const up = await screen.findByRole("button", { name: "Subir: Texto livre" })
  up.focus()
  await userEvent.keyboard("{Enter}")
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      blocks: [template.blocks[1], template.blocks[0]],
    }),
  )
  onChange.mockClear()
  await userEvent.click(screen.getByRole("button", { name: "Remover: Seção automática" }))
  await screen.findByText(/Adicione as seções obrigatórias: Itens do pedido/)
  expect(onChange).not.toHaveBeenCalled()
  expect(validity).toHaveBeenLastCalledWith(false)
  expect(screen.getByLabelText("Texto (até 500 caracteres)")).toHaveValue("Obrigado")
})

it("rejects unknown block types, arbitrary styles and duplicated automatic sections", () => {
  for (const blocks of [
    [{ type: "raw", data: { html: "<iframe>" } }],
    [{ type: "text", data: { text: "Olá", align: "left", style: "color:red" } }],
    [template.blocks[0], template.blocks[0]],
  ])
    expect(validateReceiptEditorData({ blocks }, "KITCHEN").ok).toBe(false)
})

it("keeps an invalid draft when switching receipt kinds and ignores an obsolete save failure", async () => {
  const props = { logo: "", onLogoChange: vi.fn(), onChange: vi.fn() }
  const view = render(
    <ReceiptLayoutEditor {...props} template={template} kind="KITCHEN" />,
  )
  const text = await screen.findByLabelText("Texto (até 500 caracteres)")
  let rejectOld!: (cause: Error) => void
  editor.nextSave = () =>
    new Promise((_resolve, reject) => {
      rejectOld = reject
    })
  fireEvent.input(text, { target: { value: "Primeiro texto" } })
  await waitFor(() => expect(rejectOld).toBeTypeOf("function"))
  editor.nextSave = undefined
  fireEvent.input(text, { target: { value: "<texto inválido>" } })
  await screen.findByText(/Revise os blocos/)
  await act(async () => rejectOld(new Error("obsolete failure")))
  expect(screen.queryByRole("button", { name: "Reabrir editor" })).not.toBeInTheDocument()
  const payment: ReceiptTemplate = {
    blocks: [{ type: "section", data: { section: "payment" } }],
  }
  view.rerender(<ReceiptLayoutEditor {...props} template={payment} kind="PAYMENT" />)
  await waitFor(() =>
    expect(screen.getByLabelText("Conteúdo da seção")).toHaveValue("payment"),
  )
  view.rerender(<ReceiptLayoutEditor {...props} template={template} kind="KITCHEN" />)
  await waitFor(() =>
    expect(screen.getByLabelText("Texto (até 500 caracteres)")).toHaveValue(
      "<texto inválido>",
    ),
  )
  expect(screen.getByText(/Revise os blocos/)).toBeInTheDocument()
})

it("rejects SVG and forged PNG files before creating an image URL", async () => {
  await expect(
    normalizeReceiptLogo(
      new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/PNG, JPEG ou WebP/)
  const forged = new File(["<svg/>"], "logo.png", { type: "image/png" })
  Object.defineProperty(forged, "arrayBuffer", {
    value: async () => new TextEncoder().encode("<svg/>").buffer,
  })
  await expect(
    normalizeReceiptLogo(forged, new AbortController().signal),
  ).rejects.toThrow(/PNG, JPEG ou WebP/)
})
