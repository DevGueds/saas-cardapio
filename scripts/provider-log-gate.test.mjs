import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
const { createCollector } = createRequire(import.meta.url)(
  "../docker/provider-log-gate.cjs",
)
const gate = fileURLToPath(new URL("../docker/provider-log-gate.cjs", import.meta.url))
const secrets = [
  "5511999999999@s.whatsapp.net",
  "private-key-material",
  "private-token",
  "private-stack",
]
function collect() {
  const output = [],
    collector = createCollector((stream, data) => output.push({ stream, data }))
  return { output, collector }
}
test("provider output keeps only enumerated metadata, including fragmented strings and Buffer writes", () => {
  const { collector, output } = collect(),
    stdout = collector.streamReader("stdout"),
    stderr = collector.streamReader("stderr")
  const payload =
    JSON.stringify({
      level: 50,
      event: "connection.close",
      err: {
        name: "TypeError",
        code: "ECONNRESET",
        message: secrets[2],
        stack: secrets[3],
      },
      jid: secrets[0],
      key: secrets[1],
    }) + "\n"
  const bytes = Buffer.from(payload)
  for (let index = 0; index < bytes.length; index += 7)
    stdout.write(bytes.subarray(index, index + 7))
  stderr.write(Buffer.from(secrets.join("\n")))
  stdout.end()
  stderr.end()
  collector.flush()
  assert.equal(output[0].data.records.stdout, 1)
  assert.equal(output[0].data.records.stderr, 4)
  assert.equal(output[0].data.codes.ECONNRESET, 1)
  assert.equal(output[0].data.types.TypeError, 1)
  assert.equal(output[0].data.events["connection.close"], 1)
  for (const secret of secrets) assert.ok(!JSON.stringify(output).includes(secret))
})
test("oversized output stays bounded and prototype names cannot create metadata categories", () => {
  const { collector, output } = collect(),
    reader = collector.streamReader("stdout")
  reader.write(Buffer.alloc(1024 * 1024, 65))
  reader.write(
    Buffer.from('\n{"level":"__proto__","code":"private-token","event":"constructor"}\n'),
  )
  reader.end()
  collector.flush()
  collector.flush()
  assert.equal(output.length, 1)
  assert.equal(output[0].data.oversized, 1)
  assert.deepEqual(output[0].data.levels, { info: 2 })
  assert.deepEqual(output[0].data.codes, {})
  assert.deepEqual(output[0].data.events, {})
  assert.ok(JSON.stringify(output).length < 400)
})
function run(source, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [gate, process.execPath, "-e", source, ...args],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    )
    let output = ""
    child.stdout.on("data", (value) => {
      output += value
    })
    child.stderr.on("data", (value) => {
      output += value
    })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, output }))
  })
}
test("supervisor captures console and direct writes, preserves callbacks, backpressure and exit code", async () => {
  const result = await run(
    `console.log(${JSON.stringify(secrets[0])}); process.stderr.write(Buffer.from(${JSON.stringify(secrets[1])})); const chunk=Buffer.alloc(1024*1024,65); process.stdout.write(chunk,()=>{ process.stderr.write(${JSON.stringify(secrets[2])},()=>{process.exitCode=7}) })`,
  )
  assert.equal(result.code, 7)
  for (const secret of secrets) assert.ok(!result.output.includes(secret))
  const records = result.output
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
  assert.ok(records.some((record) => record.event === "provider_output_summary"))
  assert.ok(
    records.some(
      (record) => record.event === "provider_process_exited" && record.exitCode === 7,
    ),
  )
  assert.ok(result.output.length < 1500)
})
test(
  "supervisor forwards termination to the process group on POSIX",
  { skip: process.platform === "win32", timeout: 15000 },
  async () => {
    const child = spawn(
      process.execPath,
      [
        gate,
        process.execPath,
        "-e",
        "process.on('SIGTERM',()=>process.exit(0)); console.log('ready'); setInterval(()=>{},100)",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    const completed = new Promise((resolve, reject) => {
      child.on("close", resolve)
      child.on("error", reject)
    })
    // First output summary proves the child has installed its handler before signalling.
    await new Promise((resolve) => {
      let output = ""
      child.stdout.on("data", (chunk) => {
        output += chunk
        if (output.includes("provider_output_summary")) resolve()
      })
    })
    child.kill("SIGTERM")
    assert.equal(await completed, 0)
  },
)
