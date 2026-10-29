import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import type EditorJS from "@editorjs/editorjs"
import type { LogLevels, OutputData } from "@editorjs/editorjs"
import {
  printingLogoSchema,
  type ReceiptBlock,
  type ReceiptKind,
  type ReceiptTemplate,
} from "@cardapio/contracts"
import { createReceiptTools } from "./receipt-editor-tools"
import { validateReceiptEditorData } from "./receipt-editor-data"
import { normalizeReceiptLogo } from "./receipt-editor-logo"
import { InputField, SelectField } from "../../../shared/presentation/Fields"
import "./receipt-editor.css"

export interface ReceiptLayoutEditorProps {
  template: ReceiptTemplate
  kind: ReceiptKind
  logo: string
  onChange(template: ReceiptTemplate): void
  onLogoChange(logo: string): void
  onValidityChange?(valid: boolean): void
  disabled?: boolean
}

const newBlocks: Record<ReceiptBlock["type"], ReceiptBlock> = {
  text: { type: "text", data: { text: "", align: "left" } },
  logo: { type: "logo", data: { size: "medium" } },
  section: { type: "section", data: { section: "store" } },
  divider: { type: "divider", data: {} },
}

interface EditorSession {
  insert(type: ReceiptBlock["type"]): void
  replace(output: OutputData): void
}

function ReceiptEditorSurface({
  template,
  kind,
  logo,
  onChange,
  onLogoChange,
  onValidityChange,
  disabled,
  initialOutput,
  rememberDraft,
}: ReceiptLayoutEditorProps & {
  initialOutput: OutputData
  rememberDraft(output: OutputData): void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const session = useRef<EditorSession | null>(null)
  const draft = useRef(initialOutput)
  const published = useRef(JSON.stringify(template))
  const incoming = useRef(JSON.stringify(template))
  const callbacks = useRef({ onChange, onLogoChange, onValidityChange, rememberDraft })
  const upload = useRef<AbortController | null>(null)
  const layoutValid = useRef(false)
  const logoPending = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [validation, setValidation] = useState("")
  const [failure, setFailure] = useState("")
  const [uploading, setUploading] = useState(false)
  const [logoError, setLogoError] = useState("")
  const [newType, setNewType] = useState<ReceiptBlock["type"]>("text")

  useLayoutEffect(() => {
    callbacks.current = { onChange, onLogoChange, onValidityChange, rememberDraft }
  }, [onChange, onLogoChange, onValidityChange, rememberDraft])

  useEffect(() => () => upload.current?.abort(), [])

  const reportValidity = useCallback((valid: boolean) => {
    layoutValid.current = valid
    callbacks.current.onValidityChange?.(valid && !logoPending.current)
  }, [])

  useEffect(() => {
    const target = holder.current
    if (!target) return
    const mountPoint = document.createElement("div")
    target.replaceChildren(mountPoint)
    let active = true
    let instance: EditorJS | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let sequence = 0
    let changingDocument = false
    let disposed = false
    let broken = false
    let renderQueue = Promise.resolve()
    setStatus("loading")
    setFailure("")
    reportValidity(false)

    const fail = () => {
      if (!active) return
      broken = true
      sequence++
      clearTimeout(timer)
      setStatus("failed")
      setFailure(
        "Não foi possível atualizar o editor. Seu rascunho foi mantido; tente reabrir o editor.",
      )
      reportValidity(false)
    }

    const remember = (output: OutputData) => {
      draft.current = output
      callbacks.current.rememberDraft(output)
    }

    const publish = (output: OutputData) => {
      const result = validateReceiptEditorData(output, kind)
      setValidation(result.ok ? "" : result.message)
      reportValidity(result.ok)
      if (result.ok) {
        const serialized = JSON.stringify(result.template)
        if (serialized !== published.current) {
          published.current = serialized
          callbacks.current.onChange(result.template)
        }
      }
    }

    const tools = createReceiptTools(() => changed())

    const save = async (revision: number) => {
      if (!instance || !active || broken) return
      try {
        const output = await instance.save()
        if (!active || revision !== sequence || changingDocument) return
        const current = tools.snapshot(instance)
        // Editor.js can skip unsupported/invalid blocks. Reject that result instead
        // of publishing a template whose visible content was silently removed.
        if (
          output.blocks.length !== current.blocks.length ||
          output.blocks.some(
            (block, index) =>
              block.id !== current.blocks[index]?.id ||
              block.type !== current.blocks[index]?.type ||
              JSON.stringify(block.data) !== JSON.stringify(current.blocks[index]?.data),
          )
        )
          throw new Error("O editor não preservou todos os blocos.")
        remember(current)
        publish(output)
      } catch {
        if (revision === sequence && !changingDocument) fail()
      }
    }

    function changed() {
      if (!active || !instance || changingDocument || broken) return
      sequence++
      clearTimeout(timer)
      reportValidity(false)
      try {
        remember(tools.snapshot(instance))
      } catch {
        fail()
        return
      }
      const revision = sequence
      timer = setTimeout(() => {
        void save(revision)
      }, 180)
    }

    const destroy = () => {
      if (disposed || !instance || typeof instance.destroy !== "function") return
      disposed = true
      try {
        instance.destroy()
      } catch {
        /* A partially initialized editor may already be detached. */
      }
    }

    void (async () => {
      try {
        const { default: Editor } = await import("@editorjs/editorjs")
        if (!active) return
        const startingData = draft.current
        instance = new Editor({
          holder: mountPoint,
          data: startingData,
          tools: tools.tools,
          defaultBlock: "text",
          inlineToolbar: false,
          minHeight: 0,
          logLevel: "ERROR" as LogLevels,
          onChange: changed,
        })
        await instance.isReady
        if (!active) {
          destroy()
          return
        }
        if (startingData !== draft.current) await instance.blocks.render(draft.current)
        if (!active) {
          destroy()
          return
        }
        session.current = {
          insert(type) {
            if (!instance || changingDocument) return
            if (instance.blocks.getBlocksCount() >= 32) {
              setValidation(
                "O limite é de 32 blocos. Remova um bloco antes de adicionar outro.",
              )
              return
            }
            try {
              const block = newBlocks[type]
              const added = instance.blocks.insert(
                type,
                { ...block.data },
                undefined,
                instance.blocks.getBlocksCount(),
                false,
              )
              added.holder.querySelector<HTMLElement>("textarea, select, button")?.focus()
              changed()
            } catch {
              fail()
            }
          },
          replace(output) {
            if (!instance) return
            changingDocument = true
            sequence++
            const revision = sequence
            clearTimeout(timer)
            remember(output)
            reportValidity(false)
            renderQueue = renderQueue
              .then(async () => {
                if (!active || revision !== sequence || !instance) return
                await instance.blocks.render(output)
                if (!active || revision !== sequence) return
                changingDocument = false
                changed()
              })
              .catch(() => {
                if (revision === sequence) fail()
              })
          },
        }
        setStatus("ready")
        remember(tools.snapshot(instance))
        publish(draft.current)
      } catch {
        fail()
        destroy()
      }
    })()

    return () => {
      active = false
      sequence++
      clearTimeout(timer)
      session.current = null
      destroy()
      mountPoint.remove()
    }
  }, [kind, attempt, reportValidity])

  useEffect(() => {
    const serialized = JSON.stringify(template)
    if (incoming.current === serialized) return
    incoming.current = serialized
    if (serialized === published.current) return
    published.current = serialized
    const output = { blocks: template.blocks }
    draft.current = output
    callbacks.current.rememberDraft(output)
    session.current?.replace(output)
  }, [template])

  const changeLogo = async (file: File) => {
    upload.current?.abort()
    const controller = new AbortController()
    upload.current = controller
    logoPending.current = true
    reportValidity(layoutValid.current)
    setUploading(true)
    setLogoError("")
    try {
      const normalized = await normalizeReceiptLogo(file, controller.signal)
      if (!controller.signal.aborted) callbacks.current.onLogoChange(normalized)
    } catch (error) {
      if (!controller.signal.aborted)
        setLogoError(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o logo. Selecione outra imagem.",
        )
    } finally {
      if (!controller.signal.aborted) {
        logoPending.current = false
        setUploading(false)
        reportValidity(layoutValid.current)
      }
    }
  }

  const safeLogo = logo && printingLogoSchema.safeParse(logo).success ? logo : ""
  return (
    <section className="receipt-editor" aria-label="Editor do comprovante">
      {status === "loading" && <p role="status">Carregando editor de comprovantes…</p>}
      {failure && (
        <div className="error-notice" role="alert">
          <p>{failure}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reabrir editor
          </button>
        </div>
      )}
      {validation && (
        <p className="error-notice" role="alert">
          {validation}
        </p>
      )}
      <fieldset
        disabled={disabled || status !== "ready"}
        className="receipt-editor-controls"
      >
        <legend className="sr-only">Blocos do comprovante</legend>
        <div
          ref={holder}
          className="receipt-editor-holder"
          aria-label="Blocos do comprovante"
        />
        <div className="receipt-editor-add">
          <SelectField
            label="Novo bloco"
            value={newType}
            onChange={(event) => setNewType(event.target.value as ReceiptBlock["type"])}
          >
            <option value="text">Texto livre</option>
            <option value="logo">Logo da loja</option>
            <option value="section">Seção automática</option>
            <option value="divider">Linha divisória</option>
          </SelectField>
          <button
            type="button"
            className="secondary-button"
            onClick={() => session.current?.insert(newType)}
          >
            Adicionar bloco
          </button>
        </div>
      </fieldset>
      <fieldset className="receipt-editor-logo" disabled={disabled || uploading}>
        <legend>Logo nos comprovantes</legend>
        {safeLogo && (
          <img src={safeLogo} alt="Logo usado nos comprovantes" width={96} height={96} />
        )}
        <InputField
          label="Enviar logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          help="PNG, JPEG ou WebP · até 5 MB"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void changeLogo(file)
          }}
        />
        {safeLogo && (
          <button
            type="button"
            className="text-button"
            onClick={() => callbacks.current.onLogoChange("")}
          >
            Remover imagem do logo
          </button>
        )}
        {uploading && <p role="status">Preparando logo…</p>}
        {logoError && (
          <p className="field-error" role="alert">
            {logoError}
          </p>
        )}
      </fieldset>
    </section>
  )
}

export default function ReceiptLayoutEditor(props: ReceiptLayoutEditorProps) {
  const recovery = useRef(
    new Map<ReceiptKind, { output: OutputData; external: string }>(),
  )
  const external = JSON.stringify(props.template)
  useLayoutEffect(() => {
    const saved = recovery.current.get(props.kind)
    if (saved) saved.external = external
  }, [props.kind, external])
  const rememberDraft = useCallback(
    (output: OutputData) => {
      recovery.current.set(props.kind, { output, external })
    },
    [props.kind, external],
  )
  const saved = recovery.current.get(props.kind)
  return (
    <ErrorBoundary
      resetKeys={[props.kind]}
      onError={() => props.onValidityChange?.(false)}
      fallbackRender={({ resetErrorBoundary }) => (
        <div className="error-notice" role="alert">
          <p>Não foi possível exibir o editor. O último rascunho foi mantido.</p>
          <button type="button" className="secondary-button" onClick={resetErrorBoundary}>
            Reabrir editor
          </button>
        </div>
      )}
    >
      <ReceiptEditorSurface
        key={props.kind}
        {...props}
        initialOutput={
          saved?.external === external ? saved.output : { blocks: props.template.blocks }
        }
        rememberDraft={rememberDraft}
      />
    </ErrorBoundary>
  )
}
