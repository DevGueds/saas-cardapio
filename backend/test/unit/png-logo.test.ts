import { test } from "node:test"
import assert from "node:assert/strict"
import { deflateSync } from "node:zlib"
import { PNG } from "pngjs"
import {
  validLogoStructure,
  validLogoPixels,
} from "../../src/modules/printing/infrastructure/png-logo.js"
import { ParallelPrintingLogos } from "../../src/modules/printing/infrastructure/parallel-logo.js"
import { ParallelTaskRunner } from "../../src/shared/infrastructure/parallel-task.js"

const url = (bytes: Buffer) => `data:image/png;base64,${bytes.toString("base64")}`

test("logos decode in an isolated worker and damaged images cannot be persisted", async () => {
  const runner = new ParallelTaskRunner(1)
  const validator = new ParallelPrintingLogos(runner)
  try {
    const valid = PNG.sync.write(new PNG({ width: 256, height: 256 }))
    assert.equal(await validator.validate(url(valid)), true)
    const damaged = Buffer.from(valid)
    damaged[damaged.length - 17] = damaged[damaged.length - 17]! ^ 1
    assert.equal(validLogoStructure(url(damaged)), true)
    assert.equal(await validator.validate(url(damaged)), false)
    assert.equal(await validator.validate(""), true)
    assert.equal(runner.active, 0)
  } finally {
    await runner.close()
  }
})

test("small PNG headers cannot bypass the inflated pixel bound", () => {
  const valid = PNG.sync.write(new PNG({ width: 1, height: 1 }))
  const chunks: Buffer[] = [valid.subarray(0, 8)]
  for (let offset = 8; offset + 12 <= valid.length;) {
    const length = valid.readUInt32BE(offset)
    const type = valid.toString("ascii", offset + 4, offset + 8)
    if (type === "IDAT") {
      const payload = deflateSync(Buffer.alloc(1_000_000))
      const replacement = Buffer.alloc(payload.length + 12)
      replacement.writeUInt32BE(payload.length)
      replacement.write("IDAT", 4, "ascii")
      payload.copy(replacement, 8)
      // CRC is deliberately invalid too; the decompression bound runs first.
      chunks.push(replacement)
    } else chunks.push(valid.subarray(offset, offset + length + 12))
    offset += length + 12
  }
  const image = url(Buffer.concat(chunks))
  assert.equal(validLogoStructure(image), true)
  assert.equal(validLogoPixels(image), false)
  const interlaced = Buffer.from(valid)
  interlaced[28] = 1
  assert.equal(validLogoPixels(url(interlaced)), false)
  assert.equal(validLogoPixels("data:image/svg+xml;base64,PHN2Zz4="), false)
  assert.equal(validLogoPixels(url(Buffer.alloc(150001))), false)
})
