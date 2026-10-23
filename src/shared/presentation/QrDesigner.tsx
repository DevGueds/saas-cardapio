import { useEffect, useState } from "react"
import { Download, Share2 } from "lucide-react"
import { InputField, SelectField, ToggleField } from "./Fields"
import { useMutation } from "./use-mutation"
import ErrorNotice from "./ErrorNotice"
import { browserExecutor } from "../browser-executor"
import { Failure } from "../domain/failure"
import { prepareQrLogo, qrPng, downloadQr } from "./qr-image"
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
    [logoPreference, setWithLogo] = useState<boolean | null>(null),
    [attempt, retry] = useState(0)
  const withLogo = !!logo && (logoPreference ?? true)
  const generation = `${style}:${withLogo}:${attempt}`
  const [preview, setPreview] = useState<{
      url: string
      logo: string
      generation: string
      image: string
      svg: Blob
    } | null>(null),
    [error, setError] = useState<{
      generation: string
      logo: string
      url: string
      message: string
    } | null>(null),
    mutation = useMutation()
  useEffect(() => {
    let active = true,
      objectUrl = ""
    const controller = new AbortController()
    void browserExecutor
      .run("qr", "generate", async () => {
        const { default: QR } = await import("qr-code-styling")
        if (!active) return
        const embeddedLogo = withLogo
          ? await prepareQrLogo(logo, controller.signal).catch((error) => {
              if (!active) return undefined
              throw error
            })
          : undefined
        if (!active) return
        const qr = new QR({
          width: 800,
          height: 800,
          type: "svg",
          data: url,
          // At least four modules of quiet zone, even for the smallest (21x21) code.
          margin: 112,
          qrOptions: { errorCorrectionLevel: "H" },
          image: embeddedLogo,
          imageOptions: {
            imageSize: 0.2,
            margin: 8,
            crossOrigin: "anonymous",
            // Already embedded. Library saveAsBlob uses XHR, blocked by production CSP.
            saveAsBlob: false,
          },
          dotsOptions: { color: "#172f27", type: style },
          cornersSquareOptions: { type: "square" },
          // Keep finder centers solid: dotted centers can be mistaken for data modules.
          cornersDotOptions: { type: "square" },
          backgroundOptions: { color: "#ffffff" },
        })
        let timer: ReturnType<typeof setTimeout> | undefined
        const blob = await Promise.race([
          qr.getRawData("svg"),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Failure(
                    "UNEXPECTED",
                    "A geração demorou demais. Tente novamente ou desative o logo.",
                  ),
                ),
              8000,
            )
          }),
        ]).finally(() => clearTimeout(timer))
        if (!(blob instanceof Blob))
          throw new Failure("UNEXPECTED", "Não foi possível gerar o QR Code.")
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreview({ url, logo, generation, image: objectUrl, svg: blob })
        setError(null)
      })
      .then((r) => {
        if (active && !r.ok) {
          setError({ generation, logo, url, message: r.error.message })
          setPreview(null)
        }
      })
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, logo, withLogo, style, generation])
  const currentError =
    error?.generation === generation && error.logo === logo && error.url === url
      ? error.message
      : null
  const ready =
    preview?.url === url &&
    preview.logo === logo &&
    preview.generation === generation &&
    !currentError
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
                  const blob =
                    extension === "svg"
                      ? preview!.svg
                      : await qrPng(preview!.svg, AbortSignal.timeout(10000))
                  downloadQr(blob, `${filename}.${extension}`)
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
        {currentError ? (
          <div>
            <p role="alert">{currentError}</p>
            <button
              className="secondary-button"
              onClick={() => retry((value) => value + 1)}
            >
              Tentar gerar novamente
            </button>
          </div>
        ) : ready ? (
          <img src={preview.image} alt={`QR Code: ${title}`} width={280} height={280} />
        ) : (
          <p role="status">Gerando QR Code…</p>
        )}
      </div>
    </section>
  )
}
