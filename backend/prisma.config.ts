import "dotenv/config"
import { defineConfig } from "prisma/config"
import { migrationConnection } from "./prisma/connection.js"

const url = migrationConnection(process.env)

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url ? { datasource: { url } } : {}),
})
