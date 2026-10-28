/** Opt-in to Railway's encrypted private mesh, never a public TLS downgrade. */
export function railwayPrivateTransport(url: URL, env: Record<string, unknown>): boolean {
  return (
    env.PRIVATE_NETWORK_TRANSPORT === "railway" &&
    typeof env.RAILWAY_PROJECT_ID === "string" &&
    !!env.RAILWAY_PROJECT_ID &&
    typeof env.RAILWAY_ENVIRONMENT_ID === "string" &&
    !!env.RAILWAY_ENVIRONMENT_ID &&
    /^[a-z0-9][a-z0-9-]*\.railway\.internal$/.test(url.hostname)
  )
}
