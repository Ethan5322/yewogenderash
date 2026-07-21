/**
 * Apply a single SQL migration file to the target database.
 *
 * Usage: node scripts/apply-migration.mjs supabase/migrations/0002_yd_add_fees_blog_balances.sql .env
 *
 * The migration must be idempotent (IF NOT EXISTS / guarded DO blocks) so a
 * re-run on the shared Supabase project is safe. Only yd_-prefixed objects.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const sqlPath = process.argv[2];
const envPath = process.argv[3] ?? ".env";
if (!sqlPath) {
  console.error("Usage: node scripts/apply-migration.mjs <file.sql> [.env]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url || /PROJECT_REF|REGION|PASSWORD/.test(url)) {
  console.error("✗ DIRECT_URL/DATABASE_URL missing or placeholder in", envPath);
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`✓ Applied ${sqlPath}`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`✗ Failed — rolled back:`, err.message);
  process.exitCode = 2;
} finally {
  await client.end();
}
