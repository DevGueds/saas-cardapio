import { currentLegalAcceptance } from "@cardapio/contracts"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { parseEnv } from "node:util"
import { createRequire } from "node:module"
import { PNG } from "pngjs"
import { Database } from "../backend/dist/shared/infrastructure/database.js"
import { loadConfig } from "../backend/dist/app/config.js"

const { generate } = createRequire(new URL("../backend/package.json", import.meta.url))(
  "otplib",
)
const env = parseEnv(await readFile("backend/.env", "utf8"))
const database = new URL(env.TEST_DATABASE_URL)
if (!database.pathname.endsWith("_test"))
  throw new Error("Security probes require TEST_DATABASE_URL ending in _test")
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
const service = JSON.parse(docker("inspect", "cardapio-local-api-1"))[0]
const persistence = docker(
  "exec",
  "cardapio-local-api-1",
  "node",
  "--input-type=module",
  "-e",
  `
  import assert from 'node:assert/strict';
  import {createRequire} from 'node:module';
  assert.equal(new URL(process.env.DATABASE_URL).protocol, 'postgresql:');
  const require = createRequire(import.meta.url);
  for (const name of ['mysql2','mariadb','@prisma/adapter-mariadb','prisma']) {
    assert.throws(() => require.resolve(name), {code:'MODULE_NOT_FOUND'});
  }
  process.stdout.write('postgresql-only-runtime');
`,
)
assert.equal(persistence, "postgresql-only-runtime")
const name = `cardapio-security-${randomUUID().slice(0, 8)}`,
  origin = "http://127.0.0.1:8082",
  base = `${origin}/api/v1`
const testDatabase = new URL(database),
  redis = new URL(env.REDIS_URL)
testDatabase.hostname = "postgres"
testDatabase.port = "5432"
redis.hostname = "redis"
redis.port = "6379"
const runtimeEnv = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  LOG_DIRECTORY: "",
  HOST: "0.0.0.0",
  PORT: "3001",
  DATABASE_URL: testDatabase.href,
  DATABASE_TLS: "false",
  REDIS_URL: redis.href,
  SESSION_SECRET: env.SESSION_SECRET,
  CORS_ORIGINS: origin,
  SIGNUP_ENABLED: "true",
  DOCS_ENABLED: "false",
}
const created = []
async function request(method, path, data, session, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      origin,
      "Content-Type": "application/json",
      ...(session ? { cookie: session.cookie, "x-csrf-token": session.csrf } : {}),
      ...headers,
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(10000),
  })
  const body = await response.json()
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    cache: response.headers.get("cache-control"),
  }
}
function value(result) {
  assert.equal(result.body.ok, true, "Expected a successful test operation")
  return result.body.value
}
function session(result, nested = false) {
  const data = value(result)
  return { cookie: result.cookie, csrf: (nested ? data.session : data).csrfToken }
}
const cleanup = new Database(
  loadConfig({
    ...env,
    NODE_ENV: "test",
    DATABASE_URL: database.href,
    LOG_LEVEL: "silent",
    LOG_DIRECTORY: "",
  }),
)
try {
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--init",
      "--name",
      name,
      "--network",
      Object.keys(service.NetworkSettings.Networks)[0],
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--memory=384m",
      "--pids-limit=128",
      "--tmpfs=/tmp:rw,size=16m",
      "-p",
      "127.0.0.1:8082:3001",
      ...Object.keys(runtimeEnv).flatMap((key) => ["--env", key]),
      service.Image,
    ],
    {
      env: { ...process.env, ...runtimeEnv },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  )
  let ready = false
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      ready = (await request("GET", "/health/ready")).status === 200
    } catch {
      /* bounded readiness */
    }
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  assert.ok(ready, "Isolated security container did not become ready")
  assert.equal(
    docker(
      "exec",
      name,
      "node",
      "-e",
      "if(process.getuid()===0)process.exit(1);try{require('fs').writeFileSync('/app/security-write-probe','probe');process.exit(2)}catch(e){if(!['EROFS','EACCES'].includes(e.code))process.exit(3)}console.log('non-root-read-only')",
    ),
    "non-root-read-only",
  )
  for (const path of ["/me/restaurants", "/auth/mfa", "/auth/session"])
    assert.equal((await request("GET", path)).status, 401)
  assert.equal(
    (
      await request(
        "POST",
        "/auth/login",
        { email: "probe@example.test", password: "invalid" },
        undefined,
        { origin: "https://attacker.example" },
      )
    ).status,
    403,
  )
  assert.equal(
    (await request("POST", "/auth/login", { email: { $ne: null }, password: "invalid" }))
      .status,
    422,
  )
  assert.equal(
    (
      await request("POST", "/auth/login", {
        email: "probe@example.test",
        password: "' OR 1=1 --",
      })
    ).status,
    401,
  )
  const email = `${name}@security.example.test`,
    password = `test-${randomUUID()}`
  const registered = await request("POST", "/auth/register", {
    legalAcceptance: currentLegalAcceptance,
    email,
    password,
    name: "Security Probe",
    restaurantName: "Security Probe",
    slug: name,
  })
  created.push(value(registered).user.id)
  const owner = session(registered)
  const store = value(await request("GET", "/me/restaurants", undefined, owner))[0]
  const printingRoute = `/restaurants/${store.id}/printing/settings`
  const { revision, ...configuration } = value(
    await request("GET", printingRoute, undefined, owner),
  )
  const image = PNG.sync.write(new PNG({ width: 1, height: 1 }))
  const saved = await request(
    "PUT",
    printingRoute,
    {
      ...configuration,
      expectedRevision: revision,
      logo: `data:image/png;base64,${image.toString("base64")}`,
    },
    owner,
  )
  assert.equal(
    saved.status,
    200,
    "Logo decoding must work inside the restricted Docker runtime",
  )
  image[image.length - 17] ^= 1
  const rejected = await request(
    "PUT",
    printingRoute,
    {
      ...configuration,
      expectedRevision: value(saved).revision,
      logo: `data:image/png;base64,${image.toString("base64")}`,
    },
    owner,
  )
  assert.equal(rejected.status, 422)
  assert.equal(
    value(await request("GET", printingRoute, undefined, owner)).revision,
    value(saved).revision,
  )
  assert.equal(
    (
      await request("POST", "/auth/mfa/setup", { currentPassword: password }, owner, {
        "x-csrf-token": "",
      })
    ).status,
    403,
  )
  const setupResult = await request(
      "POST",
      "/auth/mfa/setup",
      { currentPassword: password },
      owner,
    ),
    setup = value(setupResult)
  assert.equal(setupResult.cache, "no-store")
  const token = await generate({ secret: setup.secret })
  const verifiedResult = await request(
      "POST",
      "/auth/mfa/verify",
      { code: token },
      owner,
    ),
    verified = session(verifiedResult, true)
  assert.ok(verified.cookie !== owner.cookie, "MFA must rotate the session cookie")
  assert.equal((await request("GET", "/me/restaurants", undefined, owner)).status, 401)
  const challenge = session(await request("POST", "/auth/login", { email, password }))
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, challenge)).body.error.code,
    "MFA_REQUIRED",
  )
  assert.equal(
    (await request("POST", "/auth/mfa/verify", { code: token }, challenge)).status,
    422,
  )
  const recovered = session(
    await request(
      "POST",
      "/auth/mfa/verify",
      { code: value(verifiedResult).recoveryCodes[0] },
      challenge,
    ),
    true,
  )
  assert.equal(
    (await request("GET", "/me/restaurants", undefined, recovered)).status,
    200,
  )
  console.log(
    "Docker security: non-root, read-only, isolated logo decoding, corrupt PNG rejection, authentication, injection validation, CSRF, no-store, MFA bypass and replay probes passed in _test.",
  )
} finally {
  try {
    docker("rm", "-f", name)
  } catch {
    /* container may not have started */
  }
  try {
    await cleanup.transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: created }, email: { endsWith: "@security.example.test" } },
        select: { id: true },
      })
      const userId = { in: users.map((user) => user.id) },
        members = await tx.membership.findMany({
          where: { userId, role: "OWNER" },
          select: { tenantId: true },
        }),
        tenantId = { in: members.map((member) => member.tenantId) }
      await tx.restaurant.deleteMany({ where: { tenantId } })
      await tx.membership.deleteMany({ where: { userId } })
      await tx.tenant.deleteMany({ where: { id: tenantId } })
      await tx.user.deleteMany({ where: { id: userId } })
    })
  } finally {
    await cleanup.close()
  }
}
