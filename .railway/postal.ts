import { github, image, preserve, service, volume } from "railway/iac"

/** Optional and independent: never referenced by API health checks or migrations. */
export function postalResources(repository: string, branch: string, emailEnabled = false, existing?: { name: string; sizeMB: number; region?: string }) {
  const data = volume(existing?.name ?? "postal-data", { sizeMB: existing?.sizeMB ?? 4096, ...(existing?.region ? { region: existing.region } : {}) })
  const database = service("postal-db", {
    source: image("mariadb:11.4"),
    start: "docker-entrypoint.sh mariadbd --bind-address=::",
    volumeMounts: { "/var/lib/mysql": data },
    env: {
      MARIADB_ROOT_PASSWORD: preserve(),
      MARIADB_ROOT_HOST: "%",
      MARIADB_DATABASE: "postal",
    },
  })
  const postal = service("postal", {
    source: github(repository, { branch, rootDirectory: "/railway/postal" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["/railway/postal/**"],
    },
    healthcheck: "/login",
    healthcheckTimeout: 240,
    env: {
      PORT: "5000",
      BIND_ADDRESS: "0.0.0.0",
      POSTAL_ENABLED: preserve(),
      POSTAL_DELIVERY_ENABLED: "false",
      EMAIL_SEND_ENABLED: String(emailEnabled),
      MAIN_DB_HOST: database.env.RAILWAY_PRIVATE_DOMAIN,
      MAIN_DB_USERNAME: "root",
      MAIN_DB_PASSWORD: database.env.MARIADB_ROOT_PASSWORD,
      MAIN_DB_DATABASE: "postal",
      POSTAL_ADMIN_EMAIL: preserve(),
      POSTAL_ADMIN_PASSWORD: preserve(),
      POSTAL_SIGNING_KEY_BASE64: preserve(),
      RAILS_SECRET_KEY: preserve(),
    },
  })
  return [database, postal, data]
}
