import { useCallback, useRef, useState } from "react"
import type { ReceiptDocument } from "@cardapio/contracts"
import type { ReceiptOutput } from "../application/receipt-output"
import { useServices } from "../../../app/presentation/ServicesProvider"
import { useResource } from "../../../shared/presentation/use-resource"
import { useMutation } from "../../../shared/presentation/use-mutation"
import { Failure } from "../../../shared/domain/failure"
import ErrorNotice from "../../../shared/presentation/ErrorNotice"
import Dialog from "../../../shared/presentation/Dialog"

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement("a")
  link.href = url
  link.download = filename
  window.document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export default function ReceiptPreview({ document }: { document: ReceiptDocument }) {
  const { receiptOutput } = useServices()
  const load = useCallback(async () => {
    if (!receiptOutput)
      throw new Failure("CAPABILITY_UNAVAILABLE", "Geração de comprovantes indisponível.")
    return receiptOutput.create(document)
  }, [receiptOutput, document])
  const resource = useResource(load)
  return (
    <div className="receipt-preview">
      {resource.loading && <p role="status">Gerando prévia e PDF…</p>}
      {resource.error && (
        <ErrorNotice error={resource.error} onRetry={() => void resource.reload()} />
      )}
      {resource.data && !resource.loading && !resource.error && (
        <ReceiptOutputActions document={document} output={resource.data} />
      )}
    </div>
  )
}

function ReceiptOutputActions({
  document,
  output,
}: {
  document: ReceiptDocument
  output: ReceiptOutput
}) {
  const { receiptOutput } = useServices()
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [binary, setBinary] = useState(false)
  const mutation = useMutation()
  async function print() {
    await mutation.run(async () => {
      const target = frame.current?.contentWindow
      if (!target || !ready)
        throw new Failure(
          "CAPABILITY_UNAVAILABLE",
          "Aguarde a prévia ou baixe o PDF para imprimir.",
        )
      await target.document.fonts?.ready
      target.focus()
      target.print()
      return { ok: true, value: undefined }
    }, "Janela de impressão aberta. Confirme a impressora e as opções no dispositivo.")
  }
  async function exportBinary() {
    if (!receiptOutput) return
    const result = await mutation.run(async () => {
      const generated = await receiptOutput!.escpos(document)
      if (generated.ok) download(generated.value.blob, generated.value.filename)
      return generated
    }, "Arquivo ESC/POS gerado. Nenhum comando foi enviado à impressora.")
    if (result?.ok) setBinary(false)
  }
  return (
    <>
      <div className="receipt-actions">
        <button
          type="button"
          className="primary-button"
          disabled={!ready || mutation.pending}
          onClick={() => void print()}
        >
          Imprimir pelo sistema
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={mutation.pending}
          onClick={() =>
            void mutation.run(async () => {
              download(output.pdf, output.filename)
              return { ok: true, value: undefined }
            })
          }
        >
          Baixar PDF
        </button>
      </div>
      <p className="field-help">
        {output.pageCount} página(s), incluindo {document.profile.copies} via(s). No
        diálogo da impressora, use <strong>1 cópia</strong>, papel de{" "}
        {document.profile.paperWidthMm} mm, escala de 100% e desative cabeçalhos e rodapés
        do navegador. Confira a prévia do sistema antes de confirmar.
      </p>
      {output.warnings.map((warning) => (
        <p className="info-notice" key={warning}>
          {warning}
        </p>
      ))}
      {mutation.error && <ErrorNotice error={mutation.error} />}
      <iframe
        ref={frame}
        title="Prévia do comprovante"
        className="receipt-frame"
        srcDoc={output.html}
        sandbox="allow-same-origin allow-modals"
        onLoad={() => setReady(true)}
      />
      <details className="receipt-advanced">
        <summary>Arquivo térmico ESC/POS (avançado)</summary>
        <p>
          Para impressoras compatíveis com ESC/POS, gere um arquivo binário para um
          utilitário local de impressão em modo RAW. Não abra como texto nem use um driver
          que converta o conteúdo. Bluetooth por si só não confirma essa compatibilidade.
        </p>
        <p className="field-help">
          O aplicativo não envia comandos pela rede nem emparelha dispositivos. Não há
          confirmação de impressão física ao gerar um arquivo ou fechar o diálogo do
          sistema.
        </p>
        <button
          type="button"
          className="secondary-button"
          disabled={mutation.pending || document.profile.paperWidthMm > 83}
          onClick={() => {
            mutation.clearError()
            setBinary(true)
          }}
        >
          Gerar arquivo ESC/POS
        </button>
        {document.profile.paperWidthMm > 83 && (
          <p className="field-help">
            Escolha um perfil térmico de até 83 mm para essa saída.
          </p>
        )}
      </details>
      {binary && (
        <Dialog
          title="Confirmar compatibilidade térmica"
          busy={mutation.pending}
          onClose={() => setBinary(false)}
        >
          <p>
            O arquivo contém {document.profile.copies} via(s), resolução de{" "}
            {document.profile.dpi} dpi e{" "}
            {document.profile.cut === "NONE"
              ? "nenhum comando de corte"
              : document.profile.cut === "FULL"
                ? "comando de corte total"
                : "comando de corte parcial"}
            . Use apenas se o manual da sua impressora confirmar ESC/POS e suporte a essas
            opções.
          </p>
          <p>
            Se você ainda não conhece o modelo Bluetooth, prefira o PDF ou a impressão
            pelo sistema.
          </p>
          {mutation.error && <ErrorNotice error={mutation.error} />}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={mutation.pending}
              onClick={() => setBinary(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={mutation.pending}
              onClick={() => void exportBinary()}
            >
              {mutation.pending ? "Gerando…" : "Compatibilidade conferida, gerar arquivo"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
