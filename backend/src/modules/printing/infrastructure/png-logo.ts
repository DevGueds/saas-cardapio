import { inflateSync } from "node:zlib"
import { PNG } from "pngjs"

export function validLogoStructure(logo: string): boolean {
  if (!logo) return true
  if (logo.length > 200_000 || !logo.startsWith("data:image/png;base64,")) return false
  const encoded = logo.slice("data:image/png;base64,".length)
  const bytes = Buffer.from(encoded, "base64")
  if (bytes.length < 45 || bytes.toString("base64") !== encoded) return false
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return false
  if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR")
    return false
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20)
  if (!width || !height || width > 2048 || height > 2048 || width * height > 4_194_304)
    return false
  let offset = 8,
    imageData = false
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    if (offset + 12 + length > bytes.length) return false
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    if (type === "IDAT") imageData = true
    if (type === "IEND") return imageData && length === 0 && offset + 12 === bytes.length
    offset += length + 12
  }
  return false
}

/** Decode only bounded, non-interlaced PNGs emitted by the browser's logo normalizer. */
export function validLogoPixels(logo: string): boolean {
  if (!logo) return true
  if (!validLogoStructure(logo)) return false
  try {
    const bytes = Buffer.from(logo.slice("data:image/png;base64,".length), "base64")
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20)
    const depth = bytes[24]!,
      color = bytes[25]!
    const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
    if (
      !channels[color] ||
      ![1, 2, 4, 8, 16].includes(depth) ||
      bytes[26] !== 0 ||
      bytes[27] !== 0 ||
      bytes[28] !== 0
    )
      return false
    const expected = height * (1 + Math.ceil((width * channels[color]! * depth) / 8))
    const chunks: Buffer[] = []
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset)
      if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT")
        chunks.push(bytes.subarray(offset + 8, offset + 8 + length))
      offset += length + 12
    }
    // pngjs can accept excess inflated bytes. Bound and check the exact scanline size
    // before decoding; never use its unbounded interlaced inflation path.
    if (
      inflateSync(Buffer.concat(chunks), { maxOutputLength: expected }).length !==
      expected
    )
      return false
    const decoded = PNG.sync.read(bytes, { checkCRC: true })
    return decoded.width === width && decoded.height === height
  } catch {
    return false
  }
}
