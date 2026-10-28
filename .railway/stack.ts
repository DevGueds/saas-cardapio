import {
  github,
  image,
  project,
  service,
  volume,
  type ServiceConfigInput,
} from "railway/iac"
import { validateParameters, type StackParameters } from "./parameters.ts"

/** No remote mutation and no secret generation during plan/evaluation. */
export function createStack(input: StackParameters) {
  const p = validateParameters(input)
  const source = github(p.repository, { branch: p.branch, rootDirectory: "/" })
  const build = (path: string): ServiceConfigInput["build"] => {
    const shared = [
      "/package.json",
      "/pnpm-lock.yaml",
      "/pnpm-workspace.yaml",
      "/.pnpmfile.cjs",
      "/packages/**",
    ]
    const watchPatterns = path.includes("/api/")
      ? [...shared, "/backend/**", "/railway/api/**"]
      : path.includes("/web/")
        ? [
            ...shared,
            "/src/**",
            "/public/**",
            "/index.html",
            "/vite.config.ts",
            "/tsconfig*.json",
            "/railway/web/**",
          ]
        : path.includes("/evolution/")
          ? ["/railway/evolution/**", "/docker/provider-log-gate.cjs"]
          : ["/" + path.slice(0, path.lastIndexOf("/")) + "/**"]
    return { builder: "DOCKERFILE", dockerfilePath: path, watchPatterns }
  }
  const run = {
    restartPolicyType: "ON_FAILURE" as const,
    restartPolicyMaxRetries: 5,
    sleepApplication: false,
    drainingSeconds: 15,
  }
  const postgresData = volume("postgres-data", { sizeMB: 4096 })
  const redisData = volume("redis-data", { sizeMB: 1024 })
  const evolutionData = volume("evolution-database", { sizeMB: 2048 })
  const evolutionSessions = volume("evolution-sessions", { sizeMB: 1024 })
  const postgres = service("postgres", {
    source,
    build: build("railway/postgres/Dockerfile"),
    deploy: run,
    volumeMounts: { "/var/lib/postgresql": postgresData },
    env: {
      POSTGRES_USER: "postgres",
      POSTGRES_DB: "postgres",
      POSTGRES_PASSWORD: p.secrets.postgres,
      POSTGRES_APP_PASSWORD: p.secrets.app,
      POSTGRES_MIGRATION_PASSWORD: p.secrets.migrator,
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --data-checksums",
      APP_URL:
        "postgresql://cardapio:${{POSTGRES_APP_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/cardapio",
      MIGRATION_URL:
        "postgresql://cardapio_migrator:${{POSTGRES_MIGRATION_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/cardapio",
    },
  })
  const redis = service("redis", {
    source,
    build: build("railway/redis/Dockerfile"),
    deploy: run,
    volumeMounts: { "/data": redisData },
    env: {
      REDIS_PASSWORD: p.secrets.redis,
      REDIS_URL: "redis://:${{REDIS_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/0",
      EVOLUTION_REDIS_URL:
        "redis://:${{REDIS_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/6",
    },
  })
  const providerDb = service("evolution-db", {
    start:
      "/usr/local/bin/docker-entrypoint.sh postgres -c timezone=UTC -c log_statement=none -c log_min_error_statement=panic -c log_min_messages=fatal -c log_error_verbosity=terse",
    source: image(
      "postgres:15-alpine@sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81",
    ),
    deploy: run,
    volumeMounts: { "/var/lib/postgresql/data": evolutionData },
    env: {
      POSTGRES_USER: "evolution",
      POSTGRES_DB: "evolution",
      POSTGRES_PASSWORD: p.secrets.evolutionDatabase,
      DATABASE_URL:
        "postgresql://evolution:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/evolution?schema=public",
    },
  })
  const evolution = service("evolution", {
    source,
    build: build("railway/evolution/Dockerfile"),
    deploy: run,
    healthcheck: "/",
    healthcheckTimeout: 300,
    volumeMounts: { "/evolution/instances": evolutionSessions },
    env: {
      PORT: "8080",
      SERVER_PORT: "8080",
      SERVER_URL: "http://${{RAILWAY_PRIVATE_DOMAIN}}:8080",
      AUTHENTICATION_API_KEY: p.secrets.evolutionApi,
      AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "false",
      DATABASE_PROVIDER: "postgresql",
      DATABASE_CONNECTION_URI: providerDb.env.DATABASE_URL,
      DATABASE_CONNECTION_CLIENT_NAME: "cardapio_evolution",
      DATABASE_SAVE_DATA_INSTANCE: "true",
      DATABASE_SAVE_DATA_NEW_MESSAGE: "false",
      DATABASE_SAVE_MESSAGE_UPDATE: "false",
      DATABASE_SAVE_DATA_CONTACTS: "false",
      DATABASE_SAVE_DATA_CHATS: "false",
      DATABASE_SAVE_DATA_LABELS: "false",
      DATABASE_SAVE_DATA_HISTORIC: "false",
      CACHE_REDIS_ENABLED: "true",
      CACHE_REDIS_URI: redis.env.EVOLUTION_REDIS_URL,
      CACHE_REDIS_PREFIX_KEY: "cardapio_evolution",
      CACHE_REDIS_SAVE_INSTANCES: "false",
      CACHE_LOCAL_ENABLED: "false",
      TELEMETRY_ENABLED: "false",
      LOG_LEVEL: "ERROR",
      LOG_BAILEYS: "fatal",
      LOG_COLOR: "false",
      WEBHOOK_GLOBAL_ENABLED: "false",
      DEL_INSTANCE: "false",
      CONFIG_SESSION_PHONE_CLIENT: "Cardapio",
      CONFIG_SESSION_PHONE_NAME: "Chrome",
      QRCODE_LIMIT: "10",
      CORS_ORIGIN: "http://cardapio-internal",
      CORS_CREDENTIALS: "false",
    },
  })
  const migrate = service("migrate", {
    source,
    build: build("railway/api/Dockerfile"),
    start: "node /app/railway/migrate.mjs",
    deploy: { restartPolicyType: "NEVER", sleepApplication: false },
    env: {
      NODE_ENV: "production",
      DATABASE_TLS: "false",
      PRIVATE_NETWORK_TRANSPORT: "railway",
      MIGRATION_DATABASE_URL: postgres.env.MIGRATION_URL,
      MIGRATION_RELEASE: "${{RAILWAY_GIT_COMMIT_SHA}}",
    },
  })
  const common = {
    NODE_ENV: "production",
    HOST: "::",
    PORT: "3001",
    LOG_LEVEL: "info",
    LOG_DIRECTORY: "",
    PRIVATE_NETWORK_TRANSPORT: "railway",
    DATABASE_URL: postgres.env.APP_URL,
    DATABASE_TLS: "false",
    DATABASE_POOL_MAX: "10",
    DATABASE_CONNECTION_TIMEOUT_MS: "5000",
    DATABASE_MIGRATION_PENDING: "false",
    REDIS_URL: redis.env.REDIS_URL,
    TRUSTED_PROXY_HOPS: "1",
    TRUSTED_PROXY_CIDRS: "",
    SESSION_TTL_SECONDS: "28800",
    SESSION_COOKIE_SECURE: "auto",
    SESSION_SECRET: p.secrets.session,
    CORS_ORIGINS: p.publicOrigin || "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
    SIGNUP_ENABLED: String(p.signupEnabled),
    DOCS_ENABLED: "false",
    VAPID_PUBLIC_KEY: p.secrets.vapidPublic,
    VAPID_PRIVATE_KEY: p.secrets.vapidPrivate,
    VAPID_SUBJECT: p.contact,
    EVOLUTION_URL: evolution.env.SERVER_URL,
    EVOLUTION_API_KEY: evolution.env.AUTHENTICATION_API_KEY,
    MIGRATION_RELEASE: migrate.env.MIGRATION_RELEASE,
  }
  const api = service("api", {
    source,
    build: build("railway/api/Dockerfile"),
    start: "/app/entrypoint.sh",
    deploy: run,
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 180,
    env: { ...common, LOG_INSTANCE: "api" },
  })
  const replica = service("api-replica", {
    source,
    build: build("railway/api/Dockerfile"),
    start: "/app/entrypoint.sh",
    deploy: run,
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 180,
    env: {
      ...common,
      LOG_INSTANCE: "api-replica",
      SESSION_SECRET: api.env.SESSION_SECRET,
      VAPID_PUBLIC_KEY: api.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: api.env.VAPID_PRIVATE_KEY,
    },
  })
  const web = service("web", {
    source,
    build: build("railway/web/Dockerfile"),
    deploy: run,
    healthcheck: "/healthz",
    healthcheckTimeout: 30,
    ...(p.publicOrigin
      ? { domains: [{ domain: new URL(p.publicOrigin).hostname, port: 8080 }] }
      : {}),
    env: {
      PORT: "8080",
      API_PORT: "3001",
      API_HOST: api.env.RAILWAY_PRIVATE_DOMAIN,
      API_REPLICA_HOST: replica.env.RAILWAY_PRIVATE_DOMAIN,
    },
  })
  return project("saas-cardapio", {
    resources: [
      postgres,
      redis,
      providerDb,
      evolution,
      migrate,
      api,
      replica,
      web,
      postgresData,
      redisData,
      evolutionData,
      evolutionSessions,
    ],
  })
}
