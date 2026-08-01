/**
 * Apply every SQL migration, in order, to the database in DATABASE_URL.
 *
 * Written for CI, where a Postgres service container starts empty and the
 * integration tests need a schema. scripts/local-db.mjs already did this, but the
 * logic was locked inside the embedded-postgres boot, so CI could not reuse it —
 * which is part of why the 186 integration tests never ran on a push.
 *
 *   DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs
 *
 * REFUSES a non-local database. These files create and drop things; pointing this
 * at Supabase by accident would rewrite production. Migrations reach production by
 * being pasted into the Supabase SQL editor deliberately, never by a script.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same guard the integration tests use, for the same reason.
const isLocal =
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) && !/supabase/i.test(url);
if (!isLocal) {
  console.error(
    "Refusing to run: DATABASE_URL is not a local database.\n" +
      "This script creates and drops objects. Production migrations are applied\n" +
      "by hand in the Supabase SQL editor, deliberately, one at a time."
  );
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");

// The `_yd_` in the pattern skips the combined paste-into-supabase bundles, which
// only re-apply migrations already in this list.
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_yd_.*\.sql$/.test(f))
  .sort();

if (files.length === 0) {
  console.error("No migrations found — check supabase/migrations/.");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

let applied = 0;
for (const file of files) {
  try {
    await client.query(readFileSync(join(dir, file), "utf8"));
    console.log(`applied ${file}`);
    applied += 1;
  } catch (err) {
    console.error(`FAILED on ${file}: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(`\n${applied} migrations applied.`);
