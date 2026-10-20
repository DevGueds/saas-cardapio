import { isIP } from "node:net"
import { parseEnv } from "node:util"

export function isPrivateIPv4(address) {
  return (
    isIP(address) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
  )
}

/** Only explicit local configuration changes; all secrets and other settings survive. */
export function configureLanEnvironment(contents, address, interfaces) {
  if (
    !isPrivateIPv4(address) ||
    !Object.values(interfaces)
      .flat()
      .some((entry) => entry && !entry.internal && entry.address === address)
  )
    throw new Error("Informe um IPv4 privado pertencente a este computador.")

  const env = parseEnv(contents)
  if (env.NODE_ENV !== "development")
    throw new Error(
      "Acesso HTTP pela rede só pode ser configurado no ambiente development.",
    )

  const values = {
    WEB_BIND_ADDRESS: "0.0.0.0",
    DOCKER_CORS_ORIGINS: [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      `http://${address}:8080`,
    ],
    CORS_ORIGINS: [`http://${address}:8443`],
  }
  let result = contents
  for (const [key, added] of Object.entries(values)) {
    const value = Array.isArray(added)
      ? [...new Set([...(env[key]?.split(",").filter(Boolean) ?? []), ...added])].join(
          ",",
        )
      : added
    // Reject duplicate or multiline assignments rather than silently creating ambiguous settings.
    const pattern = new RegExp(`^(?:export\\s+)?${key}=[^\\r\\n]*`, "gm")
    const matches = [...result.matchAll(pattern)]
    if ((env[key] !== undefined && matches.length !== 1) || /[\r\n]/.test(env[key] ?? ""))
      throw new Error(`Revise a definição de ${key} em backend/.env antes de continuar.`)
    result = matches.length
      ? result.replace(pattern, `${key}=${value}`)
      : `${result.trimEnd()}\n${key}=${value}\n`
  }
  return result
}
