import { test } from "node:test"
import assert from "node:assert/strict"
import { configureLanEnvironment, isPrivateIPv4 } from "./local-network.mjs"

const interfaces = { ethernet: [{ address: "192.168.1.50", internal: false }] }
const local =
  "NODE_ENV=development\nSESSION_SECRET=keep-this-exactly\nWEB_BIND_ADDRESS=127.0.0.1\nDOCKER_CORS_ORIGINS=http://localhost:8080\nCORS_ORIGINS=http://localhost:8443\n"

test("LAN configuration is explicit, idempotent and preserves secrets/origins", () => {
  const result = configureLanEnvironment(local, "192.168.1.50", interfaces)
  assert.match(result, /SESSION_SECRET=keep-this-exactly/)
  assert.match(result, /WEB_BIND_ADDRESS=0\.0\.0\.0/)
  assert.match(
    result,
    /DOCKER_CORS_ORIGINS=http:\/\/localhost:8080,http:\/\/127\.0\.0\.1:8080,http:\/\/192\.168\.1\.50:8080/,
  )
  assert.match(
    result,
    /CORS_ORIGINS=http:\/\/localhost:8443,http:\/\/192\.168\.1\.50:8443/,
  )
  assert.equal(configureLanEnvironment(result, "192.168.1.50", interfaces), result)
})

test("rejects production, public/unknown addresses, URLs, duplicate and multiline keys", () => {
  for (const address of [
    "8.8.8.8",
    "192.168.1.99",
    "192.168.1.500",
    "127.0.0.1",
    "https://192.168.1.50",
    "0.0.0.0",
  ])
    assert.throws(() => configureLanEnvironment(local, address, interfaces))
  for (const value of [
    local.replace("development", "production"),
    local + "WEB_BIND_ADDRESS=0.0.0.0\n",
    local.replace(
      "CORS_ORIGINS=http://localhost:8443",
      'CORS_ORIGINS="http://localhost:8443\nhttp://localhost:8080"',
    ),
  ])
    assert.throws(() => configureLanEnvironment(value, "192.168.1.50", interfaces))
})

test("recognizes RFC1918 addresses only", () => {
  for (const address of ["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.0.1"])
    assert.equal(isPrivateIPv4(address), true)
  for (const address of [
    "172.15.0.1",
    "172.32.0.1",
    "169.254.1.1",
    "255.255.255.255",
    "10.999.0.1",
  ])
    assert.equal(isPrivateIPv4(address), false)
})
