import { readFileSync } from "node:fs"

const serviceRoles = [
  "postgres",
  "redis",
  "evolution-db",
  "evolution",
  "migrate",
  "api",
  "api-replica",
  "web",
] as const
export type ServiceRole = (typeof serviceRoles)[number]
const volumeRoles = [
  "postgres-data",
  "redis-data",
  "evolution-database",
  "evolution-sessions",
] as const
type VolumeRole = (typeof volumeRoles)[number]

export interface StackParameters {
  repository: string
  branch: string
  publicOrigin: string
  contact: string
  signupEnabled: boolean
  secrets: {
    postgres: string
    app: string
    migrator: string
    redis: string
    evolutionDatabase: string
    evolutionApi: string
    session: string
    vapidPublic: string
    vapidPrivate: string
  }
  deployment?: {
    servicePrefix?: string
    serviceNames?: Partial<Record<ServiceRole, string>>
    preserveVariables?: Partial<Record<ServiceRole, string[]>>
    volumes?: Partial<
      Record<VolumeRole, { name: string; sizeMB: number; region?: string }>
    >
    preserveSecrets?: Array<keyof StackParameters["secrets"]>
  }
}
export function validateParameters(value: unknown): StackParameters {
  const p = value as StackParameters
  if (
    !p ||
    !/^[\w.-]+\/[\w.-]+$/.test(p.repository) ||
    !/^[\w./-]+$/.test(p.branch) ||
    typeof p.signupEnabled !== "boolean" ||
    !/^mailto:[^\s@]+@[^\s@]+$/.test(p.contact) ||
    !p.secrets ||
    ![
      "postgres",
      "app",
      "migrator",
      "redis",
      "evolutionDatabase",
      "evolutionApi",
      "session",
    ].every((key) => /^[a-f0-9]{64}$/.test(p.secrets[key as keyof typeof p.secrets])) ||
    !/^[\w-]{87}$/.test(p.secrets.vapidPublic) ||
    !/^[\w-]{43}$/.test(p.secrets.vapidPrivate)
  )
    throw new Error(
      "Parâmetros da Railway inválidos. Execute pnpm railway:prepare; não imprima o arquivo de segredos.",
    )
  if (p.publicOrigin) {
    const url = new URL(p.publicOrigin)
    if (
      url.protocol !== "https:" ||
      url.origin !== p.publicOrigin ||
      url.username ||
      url.password
    )
      throw new Error("Informe somente a origem HTTPS pública, sem caminho.")
  }
  if (p.deployment !== undefined) {
    const d = p.deployment
    if (!d || typeof d !== "object")
      throw new Error("Mapeamento de implantação Railway inválido.")
    const volumes = Object.entries(d.volumes ?? {})
    const serviceNames = Object.entries(d.serviceNames ?? {})
    const preservedVariables = Object.entries(d.preserveVariables ?? {})
    if (
      (d.servicePrefix !== undefined && !/^[a-z0-9-]{0,40}$/.test(d.servicePrefix)) ||
      serviceNames.some(
        ([role, name]) =>
          !serviceRoles.includes(role as ServiceRole) ||
          typeof name !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(name),
      ) ||
      new Set(
        serviceRoles.map(
          (role) => d.serviceNames?.[role] ?? `${d.servicePrefix ?? ""}${role}`,
        ),
      ).size !== serviceRoles.length ||
      preservedVariables.some(
        ([role, keys]) =>
          !serviceRoles.includes(role as ServiceRole) ||
          !Array.isArray(keys) ||
          keys.some((key) => typeof key !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(key)),
      ) ||
      volumes.some(
        ([role, value]) =>
          !volumeRoles.includes(role as VolumeRole) ||
          !value ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(value.name) ||
          !Number.isInteger(value.sizeMB) ||
          value.sizeMB < 500 ||
          value.sizeMB > 1000000 ||
          (value.region !== undefined && !/^[a-z0-9-]{1,50}$/.test(value.region)),
      ) ||
      new Set(volumeRoles.map((role) => d.volumes?.[role]?.name ?? role)).size !==
        volumeRoles.length ||
      (d.preserveSecrets !== undefined &&
        (!Array.isArray(d.preserveSecrets) ||
          d.preserveSecrets.some((key) => !Object.hasOwn(p.secrets, key))))
    )
      throw new Error("Mapeamento de serviços, volumes ou segredos Railway inválido.")
  }
  return p
}
export function loadParameters(environment: string): StackParameters {
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(environment))
    throw new Error("Nome do ambiente inválido.")
  try {
    return validateParameters(
      JSON.parse(
        readFileSync(new URL(`./local/${environment}.json`, import.meta.url), "utf8"),
      ),
    )
  } catch {
    throw new Error(
      `Prepare o ambiente ${environment} com pnpm railway:prepare --environment ${environment}. O arquivo local é privado e não deve ser versionado.`,
    )
  }
}
