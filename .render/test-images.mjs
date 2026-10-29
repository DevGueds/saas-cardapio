import { execFileSync } from "node:child_process"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { fileURLToPath } from "node:url"
import { readBlueprint, resolveBlueprint } from "./blueprint.mjs"

// Fresh disposable Docker resources only. Never read backend/.env or cloud credentials.
const suffix = randomBytes(4).toString("hex"),
  projectName = `render-check-${suffix}`
if (!/^render-check-[a-f0-9]{8}$/.test(projectName)) throw new Error("unsafe_test_scope")
const folder = new URL(`../.cache/${projectName}/`, import.meta.url)
const file = new URL("compose.json", folder)
const origin = "https://cardapio-check.onrender.com"
const blueprint = await readBlueprint()
const environments = resolveBlueprint(blueprint, {
  generate: () => randomBytes(32).toString("base64"),
  origin,
})
const root = fileURLToPath(new URL("../", import.meta.url))
const compose = { services: {}, volumes: {} }
for (const node of blueprint.services) {
  const type = node.dockerfilePath?.split("/")[1]
  const service = {
    image: type ? `cardapio-render-${type}:check` : node.image.url,
    environment: {
      ...environments[node.name],
      RENDER: "true",
      RENDER_SERVICE_TYPE: node.type,
      RENDER_SERVICE_ID: "srv-abcdefghijklmnopqrst",
      RENDER_INSTANCE_ID: "isolated-docker-test",
    },
    networks: { default: { aliases: [node.name + "-test"] } },
  }
  if (node.runtime === "docker")
    service.build = { context: root, dockerfile: node.dockerfilePath }
  if (node.dockerCommand) service.command = node.dockerCommand.split(" ")
  if (node.disk) {
    compose.volumes[node.disk.name] = {}
    service.volumes = [node.disk.name + ":" + node.disk.mountPath]
  }
  const kind = node.name.replace("cardapio-", "")
  const command = ["postgres", "evolution-db"].includes(kind)
    ? ["CMD-SHELL", 'pg_isready -h 127.0.0.1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"']
    : kind === "redis"
      ? ["CMD-SHELL", 'REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli ping | grep -q PONG']
      : kind === "web"
        ? ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:10000/healthz"]
        : [
            "CMD",
            "node",
            "-e",
            `fetch('http://127.0.0.1:${kind === "evolution" ? "8080/" : kind === "migrations" ? "10000/healthz" : "3001/api/v1/health/ready"}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
          ]
  service.healthcheck = {
    test: command,
    interval: "3s",
    timeout: "5s",
    retries: 120,
    start_period: "15s",
  }
  if (kind === "web")
    service.ports = [{ target: 10000, published: "0", host_ip: "127.0.0.1" }]
  compose.services[node.name] = service
}
// A separate internal probe verifies what the actual Caddy image forwards.
compose.services["header-probe"] = {
  image:
    "node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5",
  command: [
    "node",
    "-e",
    `require('node:http').createServer((q,r)=>{r.setHeader('content-type','application/json');r.end(JSON.stringify({xff:q.headers['x-forwarded-for'],real:q.headers['x-real-ip'],forwarded:q.headers.forwarded,proto:q.headers['x-forwarded-proto']}))}).listen(3100,'0.0.0.0')`,
  ],
}
compose.services["header-web"] = {
  image: "cardapio-render-web:check",
  environment: {
    PORT: "10000",
    API_HOST: "header-probe",
    API_REPLICA_HOST: "header-probe",
    API_PORT: "3100",
  },
  ports: [{ target: 10000, published: "0", host_ip: "127.0.0.1" }],
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
const appCode = (code) =>
  `import {configureApiEnvironment} from './environment.mjs';Object.assign(process.env,configureApiEnvironment(process.env));${code}`
function nodeExec(name, code) {
  run(["exec", "-T", name, "node", "--input-type=module", "-e", code])
}
function urlFor(name) {
  const port = run(["port", name, "10000"], true)
    .trim()
    .match(/127\.0\.0\.1:(\d+)/)?.[1]
  if (!port) throw new Error("test_port_unavailable")
  return `http://127.0.0.1:${port}`
}
async function ready(names, timeout = 300000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    let all = true
    for (const name of names) {
      const id = run(["ps", "--all", "--quiet", name], true).trim()
      if (!id) throw new Error("missing_container_" + name)
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
      if (/^(exited|dead)/.test(state)) throw new Error("container_failed_" + name)
      if (state !== "running healthy") all = false
    }
    if (all) return
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error("service_health_deadline_exceeded")
}
async function proxyReady(base) {
  const deadline = Date.now() + 30000
  do {
    try {
      const response = await fetch(base + "/api/v1/health/ready", {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok && (await response.json()).ok) return
    } catch {
      /* The proxy can still be refreshing active health after a restart. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } while (Date.now() < deadline)
  throw new Error("proxy_readiness_failed")
}
try {
  if (!process.argv.includes("--skip-build")) {
    // Compose's Bake integration can parallelize stages despite --parallel=1.
    // Build each distinct image once to keep this usable on smaller machines.
    const built = new Set()
    for (const node of blueprint.services) {
      if (node.runtime !== "docker" || built.has(node.dockerfilePath)) continue
      run(["build", node.name])
      built.add(node.dockerfilePath)
    }
  }
  run([
    "up",
    "--no-build",
    "-d",
    "cardapio-postgres",
    "cardapio-redis",
    "cardapio-evolution-db",
  ])
  await ready(["cardapio-postgres", "cardapio-redis", "cardapio-evolution-db"])
  // A clean database blocks API readiness instead of applying migrations at startup.
  run([
    "run",
    "--rm",
    "--no-deps",
    "--entrypoint",
    "node",
    "cardapio-api",
    "--input-type=module",
    "-e",
    appCode(`
    import {Client} from 'pg'; import {loadConfig} from './dist/app/config.js';
    import {postgresPoolConfig} from './dist/shared/infrastructure/postgres-config.js';
    import {expectedMigrations,waitForMigrations} from './render/readiness.mjs';
    const expected=await expectedMigrations(new URL('./prisma/migrations/',import.meta.url));
    let blocked=false;try{await waitForMigrations(()=>new Client(postgresPoolConfig(loadConfig(process.env))),expected,{timeoutMs:100,delayMs:10})}catch{blocked=true}
    if(!blocked)throw new Error('unmigrated_database_was_accepted');
    console.log(JSON.stringify({event:'unmigrated_database_blocked'}));
  `),
  ])
  run([
    "run",
    "--rm",
    "--no-deps",
    "cardapio-migrations",
    "node",
    "/app/render/migrate.mjs",
  ])
  run([
    "run",
    "--rm",
    "--no-deps",
    "cardapio-migrations",
    "node",
    "/app/render/migrate.mjs",
  ])
  run([
    "up",
    "--no-build",
    "-d",
    "cardapio-migrations",
    "cardapio-evolution",
    "cardapio-api",
    "cardapio-api-replica",
    "cardapio-web",
    "header-probe",
    "header-web",
  ])
  await ready(
    [
      "cardapio-migrations",
      "cardapio-evolution",
      "cardapio-api",
      "cardapio-api-replica",
      "cardapio-web",
    ],
    600000,
  )
  const base = urlFor("cardapio-web")
  await proxyReady(base)
  const html = await fetch(base + "/menu/test-menu")
  if (!html.ok || !(await html.text()).includes('<div id="root">'))
    throw new Error("spa_routing_failed")
  const registration = await fetch(base + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "CF-Connecting-IP": "198.51.100.10",
    },
    body: JSON.stringify({
      name: "Verification",
      email: `render-${suffix}@example.test`,
      password: randomBytes(18).toString("hex"),
      restaurantName: "Verification",
      slug: `render-${suffix}`,
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
  const denied = await fetch(base + "/api/v1/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: origin.replace("https:", "http:"),
    },
    body: "{}",
  })
  if (denied.status !== 403) throw new Error("insecure_origin_was_accepted")
  for (const name of ["cardapio-api", "cardapio-api-replica"])
    nodeExec(
      name,
      appCode(`
    import {Client} from 'pg'; const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect();
    for(const sql of ['CREATE TABLE should_not_exist(id int)','UPDATE "_prisma_migrations" SET checksum=checksum WHERE false']) {
      let denied=false;try{await c.query(sql)}catch(e){denied=e.code==='42501'}if(!denied)throw new Error('runtime_privileges_exceeded')
    } await c.end();
    if(process.env.MIGRATION_DATABASE_URL||process.env.POSTGRES_PASSWORD)throw new Error('runtime_contains_admin_credential');
    const provider=await fetch(process.env.EVOLUTION_URL+'/instance/fetchInstances');if(![401,403].includes(provider.status))throw new Error('provider_authentication_failed');
    const authorized=await fetch(process.env.EVOLUTION_URL+'/instance/fetchInstances',{headers:{apikey:process.env.EVOLUTION_API_KEY}});if(!authorized.ok)throw new Error('provider_shared_api_key_failed');
    console.log(JSON.stringify({event:'runtime_privileges_and_provider_auth_verified'}));
  `),
    )
  run(["stop", "cardapio-api"])
  for (let i = 0; i < 5; i++) {
    const session = await fetch(base + "/api/v1/auth/session", {
      headers: { cookie: cookie.split(";")[0] },
    })
    if (!session.ok || !(await session.json()).ok)
      throw new Error("replica_session_or_failover_failed")
  }
  run(["start", "cardapio-api"])
  await ready(["cardapio-api"])
  const probe = urlFor("header-web")
  for (const ip of ["198.51.100.20", "2001:db8::123"]) {
    const response = await fetch(probe + "/api/probe", {
      headers: {
        "CF-Connecting-IP": ip,
        "X-Forwarded-For": "192.0.2.1, 192.0.2.2",
        "X-Real-IP": "192.0.2.3",
        Forwarded: "for=192.0.2.4",
        "X-Forwarded-Proto": "http",
      },
    })
    const value = await response.json()
    if (value.xff !== ip || value.real || value.forwarded || value.proto !== "https")
      throw new Error("proxy_header_sanitization_failed")
  }
  const invalidEdge = await fetch(probe + "/api/probe", {
    headers: {
      "CF-Connecting-IP": "192.0.2.1, 192.0.2.2",
      "X-Forwarded-For": "192.0.2.3",
    },
  })
  const fallback = await invalidEdge.json()
  if (!fallback.xff || /192\.0\.2\./.test(fallback.xff))
    throw new Error("untrusted_ip_fallback_failed")
  // Recreate stateful containers without deleting disks, then check the saved login.
  run([
    "up",
    "--no-build",
    "--force-recreate",
    "-d",
    "cardapio-postgres",
    "cardapio-redis",
    "cardapio-evolution-db",
    "cardapio-evolution",
  ])
  await ready(
    [
      "cardapio-postgres",
      "cardapio-redis",
      "cardapio-evolution-db",
      "cardapio-evolution",
    ],
    600000,
  )
  await ready(["cardapio-api", "cardapio-api-replica"])
  await proxyReady(base)
  const persisted = await fetch(base + "/api/v1/auth/session", {
    headers: { cookie: cookie.split(";")[0] },
  })
  if (!persisted.ok || !(await persisted.json()).ok)
    throw new Error("persistent_data_or_session_failed")
  console.log(
    JSON.stringify({
      event: "render_images_verified",
      checks: [
        "clean_database_blocks_unmigrated_api",
        "explicit_idempotent_migrations",
        "two_apis",
        "same_origin_spa",
        "secure_cookies",
        "origin_validation",
        "runtime_without_ddl",
        "provider_api_key",
        "header_sanitization_ipv4_ipv6",
        "replica_session_and_failover",
        "persistent_data_and_session",
      ],
    }),
  )
} catch (error) {
  console.error(
    JSON.stringify({
      event: "render_verification_failed",
      reason: error.message?.match(/^[a-z_]+$/)?.[0] ?? "check_failed_service",
    }),
  )
  // Only application/proxy logs, already redacted by their production loggers.
  run(["logs", "--tail", "35", "cardapio-api", "cardapio-api-replica", "cardapio-web"])
  throw error
} finally {
  run(["down", "--volumes", "--remove-orphans"])
  await unlink(file)
}
