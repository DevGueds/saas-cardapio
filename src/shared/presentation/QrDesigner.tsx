import { useEffect, useState } from "react"
import type QRCodeStyling from "qr-code-styling"
import { Download, Share2 } from "lucide-react"
import { InputField, SelectField, ToggleField } from "./Fields"
import { useMutation } from "./use-mutation"
import ErrorNotice from "./ErrorNotice"
import { browserExecutor } from "../browser-executor"
import { Failure } from "../domain/failure"
export default function QrDesigner({
  url,
  logo,
  title,
  filename = "cardapio",
}: {
  url: string
  logo: string
  title: string
  filename?: string
}) {
  const [style, setStyle] = useState<"square" | "rounded" | "dots">("rounded"),
    [withLogo, setWithLogo] = useState(!!logo)
  const [preview, setPreview] = useState<{
      url: string
      logo: string
      style: string
      withLogo: boolean
      image: string
      qr: QRCodeStyling
    } | null>(null),
    [error, setError] = useState<string | null>(null),
    mutation = useMutation()
  useEffect(() => {
    let active = true,
      objectUrl = ""
    void browserExecutor
      .run("qr", "generate", async () => {
        const { default: QR } = await import("qr-code-styling")
        const qr = new QR({
          width: 800,
          height: 800,
          type: "svg",
          data: url,
          margin: 80,
          qrOptions: { errorCorrectionLevel: "H" },
          image: withLogo ? logo : undefined,
          imageOptions: {
            imageSize: 0.2,
            margin: 8,
            crossOrigin: "anonymous",
            saveAsBlob: true,
          },
          dotsOptions: { color: "#172f27", type: style },
          cornersSquareOptions: { type: "square" },
          cornersDotOptions: { type: "square" },
          backgroundOptions: { color: "#ffffff" },
        })
        const blob = await Promise.race([
          qr.getRawData("svg"),
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () =>
                reject(
                  new Failure(
                    "VALIDATION",
                    "Não foi possível carregar o logo. Use uma imagem enviada nas configurações da loja ou desative o logo.",
                  ),
                ),
              12000,
            )
            void qr.getRawData("svg").then(
              () => clearTimeout(timer),
              () => clearTimeout(timer),
            )
          }),
        ])
        if (!(blob instanceof Blob))
          throw new Failure("UNEXPECTED", "Não foi possível gerar o QR Code.")
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreview({ url, logo, style, withLogo, image: objectUrl, qr })
        setError(null)
      })
      .then((r) => {
        if (active && !r.ok) {
          setError(r.error.message)
          setPreview(null)
        }
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, logo, withLogo, style])
  const ready =
    preview?.url === url &&
    preview.logo === logo &&
    preview.style === style &&
    preview.withLogo === withLogo &&
    !error
  return (
    <section className="qr-designer" aria-label={title}>
      <div>
        <h2>{title}</h2>
        <p className="field-help">
          Escolha o modelo e baixe para imprimir ou compartilhar.
        </p>
        <SelectField
          label="Modelo do QR Code"
          value={style}
          onChange={(e) => setStyle(e.target.value as typeof style)}
        >
          <option value="rounded">Arredondado</option>
          <option value="square">Clássico</option>
          <option value="dots">Pontos</option>
        </SelectField>
        <ToggleField
          label="Incluir logo da loja"
          checked={withLogo}
          disabled={!logo}
          onChange={setWithLogo}
        />
        {!logo && (
          <p className="field-help">
            Envie o logo nas configurações da loja para incluí-lo no QR Code.
          </p>
        )}
        <InputField
          label="Link de destino"
          value={url}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <div className="qr-actions">
          {(["png", "svg"] as const).map((extension) => (
            <button
              key={extension}
              className="secondary-button"
              disabled={!ready || mutation.pending}
              onClick={() =>
                void mutation.run(async () => {
                  await preview!.qr.download({ name: filename, extension })
                  return { ok: true as const, value: undefined }
                })
              }
            >
              <Download size={17} /> Baixar {extension.toUpperCase()}
            </button>
          ))}
          <button
            className="secondary-button"
            disabled={mutation.pending}
            onClick={() =>
              void mutation.run(async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title, url })
                  } catch (e) {
                    if (!(e instanceof DOMException && e.name === "AbortError")) throw e
                  }
                } else if (navigator.clipboard) await navigator.clipboard.writeText(url)
                else
                  throw new Failure(
                    "VALIDATION",
                    "Selecione e copie o link de destino acima.",
                  )
                return { ok: true as const, value: undefined }
              })
            }
          >
            <Share2 size={17} /> Compartilhar link
          </button>
        </div>
      </div>
      <div className="qr-preview">
        {error ? (
          <p role="alert">{error}</p>
        ) : ready ? (
          <img src={preview.image} alt={`QR Code: ${title}`} width={280} height={280} />
        ) : (
          <p role="status">Gerando QR Code…</p>
        )}
      </div>
    </section>
  )
}
