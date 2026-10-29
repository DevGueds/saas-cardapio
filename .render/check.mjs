import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import Ajv from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import { createHash } from "node:crypto"
import { readBlueprint, resolveBlueprint } from "./blueprint.mjs"

const blueprint = await readBlueprint()
const schema = JSON.parse(
  await readFile(new URL("./schema/render.yaml.json", import.meta.url), "utf8"),
)
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)
assert.ok(validate(blueprint), JSON.stringify(validate.errors))
assert.equal(blueprint.services.length, 8)
assert.equal(new Set(blueprint.services.map((s) => s.name)).size, 8)
assert.deepEqual(
  blueprint.services.filter((s) => s.type === "web").map((s) => s.name),
  ["cardapio-web"],
)
for (const service of blueprint.services) {
  assert.equal(service.region, "virginia")
  assert.notEqual(
    service.plan,
    "free",
    "Full stack cannot use expiring/nonpersistent Free services",
  )
  if (service.runtime === "docker") {
    assert.ok(
      (await stat(new URL("../" + service.dockerfilePath, import.meta.url))).isFile(),
    )
    assert.equal(service.dockerContext, ".")
    assert.equal(service.autoDeployTrigger, "checksPass")
  } else assert.match(service.image.url, /@sha256:[a-f0-9]{64}$/)
  if (service.type !== "web") assert.equal(service.healthCheckPath, undefined)
  if (service.disk) assert.equal(service.maxShutdownDelaySeconds, undefined)
  if (service.name !== "cardapio-migrations")
    assert.equal(service.preDeployCommand, undefined)
}
const env = resolveBlueprint(blueprint, {
  generate: (key) => createHash("sha256").update(key).digest("base64"),
  origin: "https://cardapio-check.onrender.com",
})
assert.notEqual(
  env["cardapio-postgres"].POSTGRES_APP_PASSWORD,
  env["cardapio-postgres"].POSTGRES_MIGRATION_PASSWORD,
)
assert.notEqual(
  env["cardapio-postgres"].POSTGRES_APP_PASSWORD,
  env["cardapio-postgres"].POSTGRES_PASSWORD,
)
for (const name of ["cardapio-api", "cardapio-api-replica"]) {
  assert.equal(
    env[name].DATABASE_PASSWORD,
    env["cardapio-postgres"].POSTGRES_APP_PASSWORD,
  )
  assert.equal(env[name].TRUSTED_PROXY_HOPS, "1")
  assert.equal(env[name].SESSION_COOKIE_SECURE, "auto")
  assert.equal(env[name].DOCS_ENABLED, "false")
  assert.equal(env[name].MIGRATION_DATABASE_URL, undefined)
  assert.equal(env[name].POSTGRES_PASSWORD, undefined)
}
assert.equal(
  blueprint.services.find((s) => s.name === "cardapio-migrations").preDeployCommand,
  "node /app/render/migrate.mjs",
)
assert.equal(
  env["cardapio-migrations"].DATABASE_PASSWORD,
  env["cardapio-postgres"].POSTGRES_MIGRATION_PASSWORD,
)
assert.deepEqual(
  blueprint.services
    .filter((s) => s.disk)
    .map((s) => s.disk.mountPath)
    .sort(),
  [
    "/data",
    "/evolution/instances",
    "/var/lib/postgresql",
    "/var/lib/postgresql/data",
  ].sort(),
)
console.log(
  "Render Blueprint: official schema, references, private services, persistence and credential separation verified.",
)
