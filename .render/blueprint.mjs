import { readFile } from "node:fs/promises"
import { parseDocument } from "yaml"

export async function readBlueprint() {
  const document = parseDocument(
    await readFile(new URL("../render.yaml", import.meta.url), "utf8"),
  )
  if (document.errors.length) throw new Error("invalid_render_yaml")
  return document.toJS()
}

/** Resolve the committed Blueprint in an isolated Docker test, without cloud access. */
export function resolveBlueprint(blueprint, { generate, origin }) {
  const values = new Map()
  function entries(node) {
    return (node.envVars ?? []).flatMap((entry) =>
      entry.fromGroup
        ? (blueprint.envVarGroups.find((group) => group.name === entry.fromGroup)
            ?.envVars ??
          (() => {
            throw new Error("unknown_environment_group")
          })())
        : [entry],
    )
  }
  function resolve(name, key, trail = []) {
    const token = name + "." + key
    if (values.has(token)) return values.get(token)
    if (trail.includes(token)) throw new Error("cyclic_blueprint_reference")
    const service = blueprint.services.find((node) => node.name === name)
    if (!service) throw new Error("unknown_service_reference")
    if (key === "RENDER_EXTERNAL_URL" && service.type === "web") return origin
    const entry = entries(service).find((entry) => entry.key === key)
    if (!entry) throw new Error("unknown_environment_reference")
    if (
      entry.fromService &&
      blueprint.services.find((node) => node.name === entry.fromService.name)?.type !==
        entry.fromService.type
    )
      throw new Error("service_reference_type_mismatch")
    const value = entry.generateValue
      ? generate(token)
      : entry.fromService
        ? entry.fromService.property === "host"
          ? entry.fromService.name + "-test"
          : resolve(entry.fromService.name, entry.fromService.envVarKey, [
              ...trail,
              token,
            ])
        : entry.value
    if (typeof value !== "string") throw new Error("unsupported_environment_value")
    values.set(token, value)
    return value
  }
  // Group secrets must be identical across all consuming services.
  for (const group of blueprint.envVarGroups ?? [])
    for (const entry of group.envVars) {
      const value = entry.generateValue
        ? generate(group.name + "." + entry.key)
        : entry.value
      for (const service of blueprint.services.filter((node) =>
        node.envVars?.some((e) => e.fromGroup === group.name),
      ))
        values.set(service.name + "." + entry.key, value)
    }
  return Object.fromEntries(
    blueprint.services.map((service) => [
      service.name,
      Object.fromEntries(
        entries(service).map((entry) => [entry.key, resolve(service.name, entry.key)]),
      ),
    ]),
  )
}
