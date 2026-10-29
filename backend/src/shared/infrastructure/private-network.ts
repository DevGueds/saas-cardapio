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

/** Render private TCP: explicit opt-in, provider context and exact injected host. */
export function renderPrivateTransport(url: URL, env: Record<string, unknown>): boolean {
  const postgres = ["postgres:", "postgresql:"].includes(url.protocol)
  const redis = url.protocol === "redis:"
  const host = postgres ? env.RENDER_DATABASE_HOST : redis ? env.RENDER_REDIS_HOST : null
  return (
    env.PRIVATE_NETWORK_TRANSPORT === "render" &&
    env.RENDER === "true" &&
    typeof env.RENDER_SERVICE_ID === "string" &&
    /^srv-[a-z0-9]{20,40}$/.test(env.RENDER_SERVICE_ID) &&
    env.RENDER_SERVICE_TYPE === "pserv" &&
    typeof host === "string" &&
    // Render injects single-label private DNS names, never public domains/IPs.
    /^[a-z][a-z0-9-]{1,62}$/.test(host) &&
    url.hostname === host &&
    Number(url.port || (postgres ? 5432 : 6379)) === (postgres ? 5432 : 6379)
  )
}

export function privateTransport(url: URL, env: Record<string, unknown>): boolean {
  return railwayPrivateTransport(url, env) || renderPrivateTransport(url, env)
}
