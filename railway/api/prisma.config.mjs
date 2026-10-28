import { migrationConnection } from "../dist/shared/infrastructure/migration-connection.js"
const url = migrationConnection(process.env)
if (!url) throw new Error("Configure MIGRATION_DATABASE_URL no serviço migrate.")
export default {
  schema: "/app/prisma/schema.prisma",
  migrations: { path: "/app/prisma/migrations" },
  datasource: { url },
}
