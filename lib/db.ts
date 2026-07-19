import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 runtime: the driver adapter lives here (the CLI reads
// prisma.config.ts instead). This app shares one Supabase database with the
// user's other projects; every table is yd_-prefixed and lives in the default
// `public` schema, so no custom search-path is needed. A `schema` URL param,
// if present, is still honoured for flexibility.
function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing required environment variable DATABASE_URL. " +
        "Copy .env.example to .env.local and fill it in."
    );
  }
  const schema = new URL(url).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg({ connectionString: url }, { schema });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Singleton — survives Next.js dev hot-reloads without exhausting the pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
