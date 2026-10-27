import { parseEnv } from "node:util"

export function setEnvironmentValue(contents, key, value) {
  if (/[\r\n]/.test(value)) throw new Error("Valor de configuração inválido.")
  const pattern = new RegExp(`^${key}=[^\\r\\n]*`, "gm")
  const matches = [...contents.matchAll(pattern)]
  if (matches.length > 1) throw new Error(`Configuração duplicada: ${key}.`)
  return matches.length
    ? contents.replace(pattern, () => `${key}=${value}`)
    : `${contents.trimEnd()}\n${key}=${value}\n`
}

export function configurePostgresEnvironment(contents, secret) {
  const env = parseEnv(contents)
  const legacy = env.DATABASE_URL?.startsWith("mysql:")
  if (legacy && env.NODE_ENV !== "development")
    throw new Error(
      "Migração de configuração automática permitida somente em development.",
    )
  let result = contents
  const passwords = {}
  for (const key of [
    "POSTGRES_PASSWORD",
    "POSTGRES_APP_PASSWORD",
    "POSTGRES_MIGRATION_PASSWORD",
  ]) {
    passwords[key] = env[key] ?? secret()
    if (!/^[a-f0-9]{48,128}$/.test(passwords[key]))
      throw new Error(`Configure um segredo hexadecimal válido em ${key}.`)
    if (!env[key]) result = setEnvironmentValue(result, key, passwords[key])
  }
  if (legacy) {
    result = setEnvironmentValue(result, "DATABASE_MIGRATION_PENDING", "true")
    for (const [key, old] of Object.entries({
      LEGACY_DATABASE_URL: env.DATABASE_URL,
      LEGACY_MIGRATION_DATABASE_URL: env.MIGRATION_DATABASE_URL,
      LEGACY_TEST_DATABASE_URL: env.TEST_DATABASE_URL,
      LEGACY_TEST_MIGRATION_DATABASE_URL: env.TEST_MIGRATION_DATABASE_URL,
    })) {
      if (!old || !old.startsWith("mysql:"))
        throw new Error("Configuração MySQL legada incompleta.")
      if (env[key] && env[key] !== old)
        throw new Error(`A origem ${key} já foi configurada com outro valor.`)
      result = setEnvironmentValue(result, key, old)
    }
  }
  for (const [key, user, password, database] of [
    ["DATABASE_URL", "cardapio", passwords.POSTGRES_APP_PASSWORD, "cardapio"],
    [
      "MIGRATION_DATABASE_URL",
      "cardapio_migrator",
      passwords.POSTGRES_MIGRATION_PASSWORD,
      "cardapio",
    ],
    ["TEST_DATABASE_URL", "cardapio", passwords.POSTGRES_APP_PASSWORD, "cardapio_test"],
    [
      "TEST_MIGRATION_DATABASE_URL",
      "cardapio_migrator",
      passwords.POSTGRES_MIGRATION_PASSWORD,
      "cardapio_test",
    ],
  ])
    if (legacy || !env[key])
      result = setEnvironmentValue(
        result,
        key,
        `postgresql://${user}:${password}@127.0.0.1:5433/${database}`,
      )
  return { contents: result, upgraded: !!legacy }
}
