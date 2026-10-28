import { execFileSync } from "node:child_process"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import { randomBytes, createECDH } from "node:crypto"
import { fileURLToPath } from "node:url"
import { createStack } from "../.railway/stack.ts"

// Disposable project only. Never imports backend/.env or production Railway secrets.
const suffix = randomBytes(4).toString("hex"),
  projectName = `railway-check-${suffix}`
if (!/^railway-check-[a-f0-9]{8}$/.test(projectName)) throw new Error("unsafe_test_scope")
const folder = new URL(`../.cache/${projectName}/`, import.meta.url),
  file = new URL("compose.json", folder)
const ec = createECDH("prime256v1")
ec.generateKeys()
const secrets = Object.fromEntries(
  [
    "postgres",
    "app",
    "migrator",
    "redis",
    "evolutionDatabase",
    "evolutionApi",
    "session",
  ].map((key) => [key, randomBytes(32).toString("hex")]),
)
secrets.vapidPublic = ec.getPublicKey().toString("base64url")
secrets.vapidPrivate = ec.getPrivateKey().toString("base64url")
const definition = createStack({
  repository: "VitorsmX/saas-cardapio",
  branch: "main",
  publicOrigin: "https://railway-check.up.railway.app",
  contact: "mailto:ops@example.test",
  signupEnabled: true,
  secrets,
})
const nodes = definition.resources.flat().filter((r) => r.type === "service")
function resolve(name, key, trail = []) {
  const token = name + "." + key
  if (trail.includes(token)) throw new Error("cyclic_test_variable")
  if (key === "RAILWAY_PRIVATE_DOMAIN") return name + ".railway.internal"
  if (key === "RAILWAY_GIT_COMMIT_SHA") return "docker-verification"
  const value = nodes.find((r) => r.name === name)?.variables?.[key]
  if (!value) throw new Error("missing_test_variable")
  if (value.type === "reference")
    return resolve(value.resource.slice("service.".length), value.output, [
      ...trail,
      token,
    ])
  if (value.type !== "literal") throw new Error("unsupported_test_variable")
  return value.value.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expression) => {
    const dot = expression.lastIndexOf(".")
    return dot < 0
      ? resolve(name, expression, [...trail, token])
      : resolve(expression.slice(0, dot), expression.slice(dot + 1), [...trail, token])
  })
}
const root = fileURLToPath(new URL("../", import.meta.url)),
  compose = { services: {}, volumes: {} }
for (const node of nodes) {
  const type = node.build?.dockerfilePath?.split("/")[1]
  const environment = Object.fromEntries(
    Object.keys(node.variables ?? {}).map((key) => [key, resolve(node.name, key)]),
  )
  Object.assign(environment, {
    RAILWAY_PROJECT_ID: "isolated-docker-verification",
    RAILWAY_ENVIRONMENT_ID: "isolated-docker-verification",
  })
  const service = {
    image: type ? `cardapio-railway-${type}:check` : node.source.image,
    environment,
    networks: { default: { aliases: [node.name + ".railway.internal"] } },
  }
  if (node.build) service.build = { context: root, dockerfile: node.build.dockerfilePath }
  if (node.deploy?.startCommand) service.command = node.deploy.startCommand.split(" ")
  if (node.volumeAttachments)
    service.volumes = Object.entries(node.volumeAttachments).map(([name, value]) => {
      compose.volumes[name] = {}
      return name + ":" + value.mountPath
    })
  const command =
    node.name === "postgres" || node.name === "evolution-db"
      ? ["CMD-SHELL", 'pg_isready -h 127.0.0.1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"']
      : node.name === "redis"
        ? ["CMD-SHELL", 'REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli ping | grep -q PONG']
        : node.name === "web"
          ? ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:8080/healthz"]
          : node.name !== "migrate"
            ? [
                "CMD",
                "node",
                "-e",
                `fetch('http://127.0.0.1:${node.name === "evolution" ? "8080/" : "3001/api/v1/health/ready"}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
              ]
            : null
  if (command)
    service.healthcheck = {
      test: command,
      interval: "3s",
      timeout: "5s",
      retries: 120,
      start_period: "15s",
    }
  if (node.name === "web")
    service.ports = [{ target: 8080, published: "0", host_ip: "127.0.0.1" }]
  if (["api", "api-replica"].includes(node.name))
    service.depends_on = {
      postgres: { condition: "service_healthy" },
      redis: { condition: "service_healthy" },
    }
  if (node.name === "evolution")
    service.depends_on = {
      "evolution-db": { condition: "service_healthy" },
      redis: { condition: "service_healthy" },
    }
  compose.services[node.name] = service
}
await mkdir(folder, { recursive: true, mode: 0o700 })
await writeFile(file, JSON.stringify(compose), { mode: 0o600 })
const args = ["compose", "--project-name", projectName, "--file", fileURLToPath(file)]
const run = (extra, capture = false) =>
  execFileSync("docker", [...args, ...extra], {
    cwd: root,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  })
async function waitHealthy(names, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let ready = true
    for (const name of names) {
      const id = run(["ps", "--all", "--quiet", name], true).trim()
      if (!id) throw new Error(`missing_container_${name}`)
      const state = execFileSync(
        "docker",
        [
          "inspect",
          "--format",
          "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
          id,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim()
      if (/^(exited|dead)/.test(state)) throw new Error(`container_failed_${name}`)
      if (state !== "running healthy") ready = false
    }
    if (ready) return
    if (Date.now() >= deadline) throw new Error("service_health_deadline_exceeded")
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}
try {
  if (!process.argv.includes("--skip-build")) run(["--parallel", "1", "build"])
  run([
    "up",
    "--no-build",
    "-d",
    "--wait",
    "--wait-timeout",
    "600",
    "postgres",
    "redis",
    "evolution-db",
    "evolution",
  ])
  await waitHealthy(["postgres", "redis", "evolution-db", "evolution"])
  run(["run", "--rm", "--no-deps", "migrate"])
  run([
    "up",
    "--no-build",
    "-d",
    "--wait",
    "--wait-timeout",
    "300",
    "api",
    "api-replica",
    "web",
  ])
  await waitHealthy(["api", "api-replica", "web"], 300_000)
  const port = run(["port", "web", "8080"], true)
    .trim()
    .match(/127\.0\.0\.1:(\d+)/)?.[1]
  if (!port) throw new Error("test_port_unavailable")
  const base = `http://127.0.0.1:${port}`
  const health = await fetch(base + "/api/v1/health/ready")
  if (!health.ok || !(await health.json()).ok) throw new Error("proxy_readiness_failed")
  const registration = await fetch(base + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://railway-check.up.railway.app",
      "x-real-ip": "198.51.100.10",
    },
    body: JSON.stringify({
      name: "Verification",
      email: `railway-${suffix}@example.test`,
      password: randomBytes(18).toString("hex"),
      restaurantName: "Verification",
      slug: `railway-${suffix}`,
    }),
  })
  if (!registration.ok || !(await registration.json()).ok)
    throw new Error("production_signup_failed")
  const cookie = registration.headers.get("set-cookie") ?? ""
  if (
    !cookie.startsWith("__Host-cardapio_session=") ||
    !/;\s*Secure/i.test(cookie) ||
    !/;\s*HttpOnly/i.test(cookie) ||
    !/;\s*SameSite=Lax/i.test(cookie) ||
    /;\s*Domain=/i.test(cookie)
  )
    throw new Error("secure_cookie_policy_failed")
  const session = await fetch(base + "/api/v1/auth/session", {
    headers: { cookie: cookie.split(";")[0] },
  })
  if (!session.ok || !(await session.json()).ok) throw new Error("shared_session_failed")
  const denied = await fetch(base + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://railway-check.up.railway.app",
    },
    body: "{}",
  })
  if (denied.status !== 403) throw new Error("insecure_origin_was_accepted")
  run([
    "exec",
    "-T",
    "api",
    "node",
    "--input-type=module",
    "-e",
    `import {Client} from 'pg'; const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); for(const sql of ['CREATE TABLE should_not_exist(id int)','UPDATE "_prisma_migrations" SET checksum=checksum WHERE false']) {let denied=false; try{await c.query(sql)}catch(e){denied=e.code==='42501'} if(!denied)throw new Error('runtime_privileges_exceeded')} await c.end(); console.log(JSON.stringify({event:'runtime_privileges_verified'}))`,
  ])
  console.log(
    JSON.stringify({
      event: "railway_images_verified",
      checks: [
        "clean_database",
        "separate_migrations",
        "two_apis",
        "same_origin_proxy",
        "secure_cookies",
        "origin_validation",
        "runtime_without_ddl",
        "evolution_privacy_gate",
      ],
    }),
  )
} finally {
  // Only the newly generated project name is accepted; no existing app volumes touched.
  run(["down", "--volumes", "--remove-orphans"])
  await unlink(file)
}
