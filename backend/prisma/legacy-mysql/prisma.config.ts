import "dotenv/config"
import { defineConfig } from "prisma/config"

if (process.env.NODE_ENV === "production")
  throw new Error(
    "Atualize o schema MySQL de produção pelo processo validado da origem antes de importar.",
  )
const source = process.env.LEGACY_MIGRATION_DATABASE_URL
if (!source || new URL(source).protocol !== "mysql:")
  throw new Error(
    "Configure explicitamente LEGACY_MIGRATION_DATABASE_URL para atualizar a origem legada.",
  )
export default defineConfig({
  schema: "schema.prisma",
  migrations: { path: "migrations" },
  datasource: { url: source },
})
