import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    directUrl: process.env.DIRECT_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
});