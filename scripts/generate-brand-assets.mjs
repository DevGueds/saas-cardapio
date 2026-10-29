import { chromium } from "@playwright/test"
import { readFile, writeFile } from "node:fs/promises"

// Render the editable vector at native sizes; the ICO embeds real PNG frames.
const symbol = await readFile(
  new URL("../public/brand/pede-aqui-mark.svg", import.meta.url),
  "utf8",
)
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const frames = []
  for (const size of [16, 32, 48, 64, 128, 256, 180, 192, 512]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image()
        image.src = "data:image/svg+xml;base64," + btoa(svg)
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        canvas.getContext("2d").drawImage(image, 0, 0, size, size)
        return canvas.toDataURL("image/png").split(",")[1]
      },
      { svg: symbol, size },
    )
    const png = Buffer.from(data, "base64")
    if (size === 180)
      await writeFile(
        new URL("../public/brand/apple-touch-icon.png", import.meta.url),
        png,
      )
    else if (size > 180 && size !== 256)
      await writeFile(new URL(`../public/brand/icon-${size}.png`, import.meta.url), png)
    else frames.push({ size, png })
  }
  const header = Buffer.alloc(6 + frames.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16
    header[entry] = size === 256 ? 0 : size
    header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  await writeFile(
    new URL("../public/favicon.ico", import.meta.url),
    Buffer.concat([header, ...frames.map((f) => f.png)]),
  )
  await writeFile(new URL("../public/icon.svg", import.meta.url), symbol)
  console.log("Pede Aqui: favicon ICO (6 tamanhos), ícones PWA e ícone Apple gerados.")
} finally {
  await browser.close()
}
