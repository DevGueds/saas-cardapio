import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import {
  validateGraph,
  type ResourceNode,
  type RailwayGraph,
  type ServiceNode,
} from "railway/iac"
import { createStack } from "./stack.ts"
import { validateParameters, type StackParameters } from "./parameters.ts"
const parameters: StackParameters = {
  repository: "VitorsmX/saas-cardapio",
  branch: "main",
  publicOrigin: "",
  contact: "mailto:ops@example.test",
  signupEnabled: true,
  secrets: {
    postgres: "1".repeat(64),
    app: "2".repeat(64),
    migrator: "3".repeat(64),
    redis: "4".repeat(64),
    evolutionDatabase: "5".repeat(64),
    evolutionApi: "6".repeat(64),
    session: "7".repeat(64),
    vapidPublic: "A".repeat(87),
    vapidPrivate: "B".repeat(43),
  },
}
const definition = createStack(parameters)
const resources = definition.resources!.flat() as ResourceNode[]
const services = resources.filter((r): r is ServiceNode => r.type === "service")
const get = (name: string) => services.find((s) => s.name === name)!
test("optional Postal stays independent of API health and authentication and email defaults to off", () => {
  const optional = createStack({ ...parameters, postalProvisioned: true }).resources!.flat() as ResourceNode[]
  assert.equal(optional.filter((r) => r.type === "service").length, 10)
  assert.equal(optional.filter((r) => r.type === "volume").length, 5)
  for (const name of ["api", "api-replica"]) {
    const api = optional.find((r) => r.type === "service" && r.name === name) as ServiceNode
    assert.deepEqual(api.variables?.EMAIL_SEND_ENABLED, { type: "literal", value: "false" })
    for (const value of Object.values(api.variables ?? {})) if (value.type === "reference") assert.ok(!value.resource.includes("postal"))
  }
  const postal = optional.find((r) => r.type === "service" && r.name === "postal") as ServiceNode
  assert.deepEqual(postal.variables?.POSTAL_DELIVERY_ENABLED, { type: "literal", value: "false" })
})
test("stack covers Compose services and persistent volumes without generated domains or cloud IDs", () => {
  assert.deepEqual(
    services.map((s) => s.name).sort(),
    [
      "api",
      "api-replica",
      "evolution",
      "evolution-db",
      "migrate",
      "postgres",
      "redis",
      "web",
    ].sort(),
  )
  assert.equal(resources.filter((r) => r.type === "volume").length, 4)
  const graph: RailwayGraph = {
    version: 1,
    project: { name: definition.name },
    environments: [],
    resources,
    edges: [],
  }
  for (const service of services) {
    for (const [key, value] of Object.entries(service.variables ?? {})) {
      if (value.type === "reference")
        graph.edges.push({
          from: service.address,
          to: value.resource,
          type: "variable",
          key,
        })
    }
    if (service.build?.dockerfilePath) {
      assert.equal(
        existsSync(new URL(`../${service.build.dockerfilePath}`, import.meta.url)),
        true,
      )
      assert.doesNotMatch(
        readFileSync(
          new URL(`../${service.build.dockerfilePath}`, import.meta.url),
          "utf8",
        ),
        /--mount=type=cache/,
        "Railway cache mounts require literal service IDs, unsuitable for a clean reusable stack",
      )
    }
    assert.equal(service.configFile, undefined)
    assert.equal(service.networking?.tcpProxies, undefined)
    assert.equal(service.networking?.serviceDomains, undefined)
  }
  assert.deepEqual(validateGraph(graph), [])
  assert.equal(JSON.stringify(definition).includes(".up.railway.app"), false)
  assert.equal(
    get("postgres").volumeAttachments?.["postgres-data"].mountPath,
    "/var/lib/postgresql",
  )
  assert.equal(
    get("evolution-db").volumeAttachments?.["evolution-database"].mountPath,
    "/var/lib/postgresql/data",
  )
  assert.deepEqual(get("postgres").build?.watchPatterns, ["/railway/postgres/**"])
  assert.deepEqual(get("redis").build?.watchPatterns, ["/railway/redis/**"])
  assert.equal(
    get("redis").deploy?.startCommand,
    "/bin/sh -c 'chown redis:redis /data && exec /bin/sh /opt/cardapio-redis.sh'",
  )
  assert.deepEqual(get("evolution-db").variables?.PGDATA, {
    type: "literal",
    value: "/var/lib/postgresql/data/pgdata",
  })
  assert.match(
    get("evolution-db").deploy?.startCommand ?? "",
    /^\/usr\/local\/bin\/docker-entrypoint\.sh postgres /,
  )
})
test("replicas receive only runtime credentials and wait for the separate migration service", () => {
  for (const name of ["api", "api-replica"]) {
    const s = get(name)
    assert.equal(s.variables?.MIGRATION_DATABASE_URL, undefined)
    assert.equal(s.variables?.POSTGRES_PASSWORD, undefined)
    assert.equal(s.deploy?.startCommand, "/app/entrypoint.sh")
    assert.equal(s.deploy?.healthcheckPath, "/api/v1/health/ready")
    if (name === "api-replica")
      assert.deepEqual(s.variables?.SESSION_SECRET, {
        type: "reference",
        resource: "service.api",
        output: "SESSION_SECRET",
      })
    assert.deepEqual(s.variables?.DATABASE_URL, {
      type: "reference",
      resource: "service.postgres",
      output: "APP_URL",
    })
    assert.deepEqual(s.variables?.MIGRATION_RELEASE, {
      type: "reference",
      resource: "service.migrate",
      output: "MIGRATION_RELEASE",
    })
    assert.deepEqual(s.variables?.SESSION_COOKIE_SECURE, {
      type: "literal",
      value: "auto",
    })
  }
  assert.equal(get("migrate").deploy?.restartPolicyType, "NEVER")
  assert.equal(get("migrate").deploy?.healthcheckPath, undefined)
  assert.equal(
    get("evolution").volumeAttachments?.["evolution-sessions"].mountPath,
    "/evolution/instances",
  )
})
test("plans stay deterministic, support a later custom domain, and reject unsafe parameters", () => {
  assert.deepEqual(createStack(parameters), createStack(parameters))
  const custom = createStack({ ...parameters, publicOrigin: "https://menu.example.test" })
  const web = custom.resources!.flat().find((r) => r.name === "web") as ServiceNode
  assert.deepEqual(web.networking?.customDomains, { "menu.example.test": { port: 8080 } })
  for (const publicOrigin of [
    "http://menu.example.test",
    "https://menu.example.test/path",
    "https://u:p@menu.example.test",
  ])
    assert.throws(() => validateParameters({ ...parameters, publicOrigin }))
  assert.throws(() =>
    validateParameters({
      ...parameters,
      secrets: { ...parameters.secrets, session: "password" },
    }),
  )
})

test("an imported installation keeps service names, volume identities and remote credentials", () => {
  const imported = createStack({
    ...parameters,
    deployment: {
      servicePrefix: "cardapio-",
      preserveSecrets: ["postgres", "app", "migrator", "redis", "evolutionDatabase"],
      volumes: {
        "postgres-data": { name: "existing-postgres-data", sizeMB: 500, region: "ams" },
        "redis-data": { name: "existing-redis-data", sizeMB: 500, region: "ams" },
        "evolution-database": {
          name: "existing-evolution-data",
          sizeMB: 500,
          region: "ams",
        },
        "evolution-sessions": {
          name: "new-evolution-sessions",
          sizeMB: 500,
          region: "ams",
        },
      },
    },
  })
  const nodes = imported.resources!.flat() as ResourceNode[]
  const adoptedServices = nodes.filter((n): n is ServiceNode => n.type === "service")
  const find = (role: string) =>
    adoptedServices.find((s) => s.name === `cardapio-${role}`)!
  assert.equal(adoptedServices.length, 8)
  assert.ok(adoptedServices.every((s) => s.name.startsWith("cardapio-")))
  assert.equal(find("postgres").build?.dockerfilePath, "railway/postgres/Dockerfile")
  assert.equal(find("redis").build?.dockerfilePath, "railway/redis/Dockerfile")
  for (const [role, keys] of [
    [
      "postgres",
      ["POSTGRES_PASSWORD", "POSTGRES_APP_PASSWORD", "POSTGRES_MIGRATION_PASSWORD"],
    ],
    ["redis", ["REDIS_PASSWORD"]],
    ["evolution-db", ["POSTGRES_PASSWORD"]],
  ] as const) {
    for (const key of keys)
      assert.deepEqual(find(role).variables?.[key], { type: "preserve" })
    assert.equal(find(role).deploy?.sleepApplication, false)
  }
  assert.deepEqual(find("api").variables?.DATABASE_URL, {
    type: "reference",
    resource: "service.cardapio-postgres",
    output: "APP_URL",
  })
  assert.deepEqual(find("api-replica").variables?.SESSION_SECRET, {
    type: "reference",
    resource: "service.cardapio-api",
    output: "SESSION_SECRET",
  })
  assert.deepEqual(find("api").variables?.CORS_ORIGINS, {
    type: "literal",
    value: "https://${{cardapio-web.RAILWAY_PUBLIC_DOMAIN}}",
  })
  assert.equal(
    find("postgres").volumeAttachments?.["existing-postgres-data"].mountPath,
    "/var/lib/postgresql",
  )
  const volumes = nodes.filter((n) => n.type === "volume")
  assert.equal(volumes.length, 4)
  assert.ok(volumes.every((v) => v.type === "volume" && v.config?.sizeMB === 500))
  assert.ok(volumes.every((v) => v.type === "volume" && v.config?.region === "ams"))
  for (const key of [
    "postgres",
    "app",
    "migrator",
    "redis",
    "evolutionDatabase",
  ] as const)
    assert.equal(JSON.stringify(imported).includes(parameters.secrets[key]), false)
  assert.deepEqual(
    validateGraph({
      version: 1,
      project: { name: imported.name },
      environments: [],
      resources: nodes,
      edges: [],
    }),
    [],
  )
})

test("adoption rejects invalid prefixes, colliding volumes and unknown preserved secrets", () => {
  for (const deployment of [
    { servicePrefix: "invalid.prefix" },
    { volumes: { "redis-data": { name: "postgres-data", sizeMB: 500 } } },
    { volumes: { "redis-data": { name: "redis-data", sizeMB: 0 } } },
    { preserveSecrets: ["unknown"] },
    { preserveSecrets: "postgres" },
    { serviceNames: { migrate: "api" } },
    { preserveVariables: { api: ["invalid-key"] } },
    null,
  ])
    assert.throws(() => validateParameters({ ...parameters, deployment }))
})

test("an existing migration service is adopted with references and additional variables intact", () => {
  const stack = createStack({
    ...parameters,
    deployment: {
      servicePrefix: "cardapio-",
      serviceNames: { migrate: "cardapio-migrations" },
      preserveVariables: { api: ["RENDER_DATABASE_HOST", "NODE_ENV"] },
    },
  })
  const services = stack
    .resources!.flat()
    .filter((r): r is ServiceNode => r.type === "service")
  assert.equal(services.length, 8)
  const migration = services.find((s) => s.name === "cardapio-migrations")!
  assert.equal(migration.deploy?.startCommand, "node /app/railway/migrate.mjs")
  assert.deepEqual(migration.deploy?.preDeployCommand, [])
  const api = services.find((s) => s.name === "cardapio-api")!
  assert.deepEqual(api.variables?.MIGRATION_RELEASE, {
    type: "reference",
    resource: "service.cardapio-migrations",
    output: "MIGRATION_RELEASE",
  })
  assert.deepEqual(api.variables?.RENDER_DATABASE_HOST, { type: "preserve" })
  assert.deepEqual(api.variables?.NODE_ENV, { type: "literal", value: "production" })
})
