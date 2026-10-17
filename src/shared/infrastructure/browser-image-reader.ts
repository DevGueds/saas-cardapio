import { imageUploadSchema, validationMessage } from "@cardapio/contracts"
import type { Executor } from "../application/execute"

import type { ImageReader, ImageSource } from "../application/image-reader"

import { Failure, requireValid } from "../domain/failure"

export class BrowserImageReader implements ImageReader {
  constructor(private readonly executor: Executor) {}

  read(file: ImageSource) {
    return this.executor.run("images", "read-image", async () => {
      const metadata = imageUploadSchema.safeParse({ type: file.type, size: file.size })
      if (!metadata.success) {
        const message = validationMessage(metadata.error.issues[0]!)
        throw new Failure("VALIDATION", message, { imageUrl: message })
      }

      let bytes: ArrayBuffer

      try {
        bytes = await file.arrayBuffer()
      } catch {
        throw new Failure(
          "VALIDATION",
          "Não foi possível ler a imagem. Selecione o arquivo novamente.",
        )
      }

      requireValid(
        bytes.byteLength === file.size,
        "O arquivo mudou durante a leitura.",
        "imageUrl",
      )

      const header = new Uint8Array(bytes)

      const signature =
        file.type === "image/png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every(
              (value, index) => header[index] === value,
            )
          : file.type === "image/jpeg"
            ? header[0] === 255 && header[1] === 216 && header[2] === 255
            : String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...header.slice(8, 12)) === "WEBP"

      requireValid(
        signature,
        "O conteúdo do arquivo não corresponde ao formato da imagem.",
        "imageUrl",
      )

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()

        reader.onerror = reader.onabort = () =>
          reject(
            new Failure(
              "VALIDATION",
              "Não foi possível ler a imagem. Selecione o arquivo novamente.",
            ),
          )

        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Failure("VALIDATION", "Imagem inválida."))

        reader.readAsDataURL(new Blob([bytes], { type: file.type }))
      })

      const image = new Image()

      image.src = data

      try {
        await image.decode()
      } catch {
        throw new Failure("VALIDATION", "O arquivo não contém uma imagem válida.", {
          imageUrl: "Selecione outra imagem.",
        })
      }

      requireValid(
        image.naturalWidth > 0 &&
          image.naturalHeight > 0 &&
          image.naturalWidth * image.naturalHeight <= 40_000_000,

        "A imagem excede o limite de 40 megapixels.",
        "imageUrl",
      )

      return data
    })
  }
}
