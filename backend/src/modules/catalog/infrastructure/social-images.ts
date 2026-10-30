import sharp from "sharp"
import { Failure } from "@cardapio/domain/failure"
import { defaultMenuSharing } from "@cardapio/domain/menu-sharing"
import type { MenuDocument } from "@cardapio/domain/menu-document"
import { Bulkhead } from "../../../shared/application/bulkhead.js"

export function escapeSocialText(value: string) {
  const safe = Array.from(value).filter((character) => {
    const point = character.codePointAt(0)!
    return point === 9 || point === 10 || point === 13 || (point >= 32 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || (point >= 0x10000 && point <= 0x10ffff)
  }).join("")
  return safe.replace(
    /[&<>"'{}]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "{": "&#123;",
        "}": "&#125;",
      })[character]!,
  )
}
export function socialMetadata(menu: MenuDocument, origin: string) {
  const sharing = menu.restaurant.sharing ?? defaultMenuSharing(),
    landscape = sharing.format === "LANDSCAPE"
  const title = sharing.title || menu.restaurant.name,
    description =
      sharing.description ||
      menu.restaurant.description ||
      "Confira nosso cardápio e faça seu pedido."
  const url = new URL(`/menu/${encodeURIComponent(menu.restaurant.slug)}`, origin).href
  const imageUrl = new URL(
    `/api/v1/public/restaurants/${encodeURIComponent(menu.restaurant.slug)}/share-image/${landscape ? "landscape" : "square"}.png`,
    origin,
  )
  imageUrl.searchParams.set("v", String(menu.revision))
  const image = imageUrl.href
  const meta = (key: string, value: string, attribute = "property") =>
    `<meta ${attribute}="${key}" content="${escapeSocialText(value)}">`
  return (
    `<title>${escapeSocialText(title)}</title><link rel="canonical" href="${escapeSocialText(url)}">` +
    [
      meta("description", description, "name"),
      meta("og:type", "website"),
      meta("og:locale", "pt_BR"),
      meta("og:site_name", menu.restaurant.name),
      meta("og:title", title),
      meta("og:description", description),
      meta("og:url", url),
      meta("og:image", image),
      meta("og:image:secure_url", image),
      meta("og:image:type", "image/png"),
      meta("og:image:width", landscape ? "1200" : "600"),
      meta("og:image:height", landscape ? "630" : "600"),
      meta("og:image:alt", title),
      meta("twitter:card", landscape ? "summary_large_image" : "summary", "name"),
      meta("twitter:title", title, "name"),
      meta("twitter:description", description, "name"),
      meta("twitter:image", image, "name"),
      meta("twitter:image:alt", title, "name"),
    ].join("")
  )
}
function lines(value: string, columns: number, maxLines: number) {
  const result: string[] = []
  let rest = value.trim().replace(/\s+/g, " ")
  while (rest && result.length < maxLines) {
    let end = rest.length <= columns ? rest.length : rest.lastIndexOf(" ", columns)
    if (end < columns / 3) end = Math.min(rest.length, columns)
    result.push(rest.slice(0, end))
    rest = rest.slice(end).trim()
  }
  if (rest) result[result.length - 1] = result.at(-1)!.slice(0, -1) + "…"
  return result
}
export class SocialImages {
  private readonly capacity = new Bulkhead(2)
  private readonly cache = new Map<string, Buffer>()
  private pipeline(image: string) {
    return sharp(Buffer.from(image.slice(image.indexOf(",") + 1), "base64"), {
      limitInputPixels: 40_000_000,
      animated: false,
      failOn: "error",
    }).timeout({ seconds: 4 })
  }
  async validate(image: string) {
    if (!image) return
    await this.capacity.run(async () => {
      try {
        await this.pipeline(image).resize(1, 1).png().toBuffer()
      } catch {
        throw new Failure(
          "VALIDATION",
          "A imagem não pôde ser processada. Envie outro arquivo PNG, JPEG ou WebP de até 5 MB.",
        )
      }
    })
  }
  async render(menu: MenuDocument, format: "square" | "landscape") {
    const key = `${menu.restaurant.id}:${menu.revision}:${format}`,
      cached = this.cache.get(key)
    if (cached) return cached
    return this.capacity.run(async () => {
      const width = format === "square" ? 600 : 1200,
        height = format === "square" ? 600 : 630
      const sharing = menu.restaurant.sharing ?? defaultMenuSharing(),
        custom = format === "square" ? sharing.squareImage : sharing.landscapeImage
      let output: Buffer
      if (custom)
        output = await this.pipeline(custom)
          .rotate()
          .resize(width, height, { fit: "cover", position: "centre" })
          .png()
          .toBuffer()
      else {
        const title = lines(
          sharing.title || menu.restaurant.name,
          format === "square" ? 19 : 38,
          3,
        )
        const description = lines(
          sharing.description ||
            menu.restaurant.description ||
            "Confira nosso cardápio e faça seu pedido.",
          format === "square" ? 38 : 75,
          3,
        )
        const text = (
          parts: string[],
          y: number,
          size: number,
          color: string,
          weight: number,
        ) =>
          parts
            .map(
              (part, i) =>
                `<text x="48" y="${y + i * (size + 10)}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeSocialText(part)}</text>`,
            )
            .join("")
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#123e34"/><circle cx="${width - 30}" cy="30" r="200" fill="#1b5145"/><rect x="48" y="48" width="56" height="6" rx="3" fill="#f0bd7b"/>${text(["O próximo pedido começa aqui."], 102, 19, "#e0eae3", 400)}${text(title, 185, 44, "#ffffff", 700)}${text(description, 200 + title.length * 54, 20, "#e0eae3", 400)}<rect x="48" y="${height - 100}" width="275" height="52" rx="26" fill="#f0bd7b"/>${text(["Confira nosso cardápio →"], height - 67, 19, "#123e34", 700)}</svg>`
        output = await sharp(Buffer.from(svg), { limitInputPixels: 1_000_000 })
          .png()
          .toBuffer()
      }
      if (this.cache.size >= 12) this.cache.delete(this.cache.keys().next().value!)
      this.cache.set(key, output)
      return output
    })
  }
}
