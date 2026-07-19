// Prisma CLI configuration (Prisma 7+ — datasource URLs no longer live in schema.prisma).
// The CLI (migrate/db push/studio) must use the DIRECT (non-pooled) Supabase
// connection; the runtime client in lib/db.ts uses the pooled DATABASE_URL.
// This app shares one Supabase database with the user's other projects; every
// table is yd_-prefixed in the default `public` schema, so no schema param is
// needed on the connection strings.
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
