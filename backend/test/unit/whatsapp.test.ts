import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { randomUUID } from "node:crypto"
import { EvolutionWhatsapp } from "../../src/modules/engagement/infrastructure/evolution-whatsapp.js"

test("Evolution adapter follows v2 pairing contract and never confuses an ambiguous reply with delivery", async () => {
  const scope = { restaurantId: randomUUID(), tenantId: randomUUID() }, calls: { path: string; method: string; data: unknown; origin: string | undefined }[] = []
  let exists = false, state = "close", result = 201
  const server = createServer(async (req, res) => {
    let raw = ""
    for await (const chunk of req) raw += String(chunk)
    calls.push({ path: req.url!, method: req.method!, data: raw ? JSON.parse(raw) : null, origin: req.headers.origin })
    res.setHeader("content-type", "application/json")
    if (req.url?.includes("connectionState")) { res.statusCode = exists ? 200 : 404; res.end(JSON.stringify(exists ? { instance: { state } } : {})) }
    else if (req.url === "/instance/create") { exists = true; res.statusCode = 201; res.end("{}") }
    else if (req.url?.includes("/instance/connect/")) res.end(JSON.stringify({ code: "test-pairing-code" }))
    else if (req.url?.includes("/instance/logout/")) { state = "close"; res.end("{}") }
    else { res.statusCode = result; res.end(result === 201 ? '{"key":{"id":"provider-message-id"}}' : '{"error":"private-provider-detail"}') }
  })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const provider = new EvolutionWhatsapp(`http://127.0.0.1:${address.port}`, "test-key".repeat(8))
  try {
    assert.equal((await provider.state(scope)).state, "disconnected")
    const connected = await provider.connect(scope)
    assert.equal(connected.state, "connecting")
    assert.match(connected.qr!, /^data:image\/png;base64,/)
    assert.deepEqual(calls.find(c => c.path === "/instance/create")?.data, { instanceName: `cardapio-${scope.restaurantId}`, integration: "WHATSAPP-BAILEYS", qrcode: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false })
    state = "open"
    assert.equal((await provider.state(scope)).state, "connected")
    assert.equal(await provider.send(scope, "5511999999999", "Mensagem de teste"), "SENT")
    result = 200
    assert.equal(await provider.send(scope, "5511999999999", "Mensagem de teste"), "UNKNOWN")
    result = 503
    assert.equal(await provider.send(scope, "5511999999999", "Mensagem de teste"), "UNKNOWN")
    result = 422
    assert.equal(await provider.send(scope, "5511999999999", "Mensagem de teste"), "FAILED")
    await provider.disconnect(scope)
    assert.ok(calls.every(c => c.origin === "http://cardapio-internal"))
    assert.equal(calls.find(c => c.path.includes("/instance/logout/"))?.method, "DELETE")
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) }
})
