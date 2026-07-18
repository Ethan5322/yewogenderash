// Prisma CLI configuration (Prisma 7+ — datasource URLs no longer live in schema.prisma).
// The CLI (migrate/db push/studio) must use the DIRECT (non-pooled) Supabase
// connection; the runtime client in lib/db.ts uses the pooled DATABASE_URL.
// NOTE: connection strings MUST keep `?schema=yewogen` — this app is isolated
// in the `yewogen` Postgres schema of the shared Supabase project.
import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

loadEnv(); // Prisma 7 no longer auto-loads .env for the CLI

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
