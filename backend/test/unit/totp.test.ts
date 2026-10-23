import { test } from "node:test"
import assert from "node:assert/strict"
import { generate } from "otplib"
import { Totp } from "../../src/modules/identity/infrastructure/totp.js"
test("TOTP encrypts secrets with user binding and verifies RFC periods without accepting stale codes", async () => {
  const otp = new Totp("test-only-encryption-key"),
    setup = await otp.setup("user-one", "test@example.test")
  const now = new Date("2026-10-22T12:00:00Z"),
    epoch = Math.floor(now.getTime() / 1000)
  const code = await generate({ secret: setup.secret, epoch })
  assert.equal(await otp.counter("user-one", setup.encrypted, code, now), epoch / 30)
  assert.equal(
    await otp.counter(
      "user-one",
      setup.encrypted,
      code,
      new Date(now.getTime() + 120000),
    ),
    null,
  )
  assert.equal(await otp.counter("user-one", setup.encrypted, "invalid", now), null)
  await assert.rejects(() => otp.counter("another-user", setup.encrypted, code, now))
  await assert.rejects(() =>
    new Totp("wrong-key").counter("user-one", setup.encrypted, code, now),
  )
  assert.ok(!setup.encrypted.includes(setup.secret))
  assert.match(setup.qr, /^data:image\/png;base64,/)
  const recovery = otp.recoveryCodes()
  assert.equal(new Set(recovery).size, 10)
  assert.ok(recovery.every((code) => /^[a-f0-9]{24}$/.test(code)))
})
