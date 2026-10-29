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
