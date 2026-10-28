import { readFileSync } from "node:fs"

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
