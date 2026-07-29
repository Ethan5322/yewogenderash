/**
 * Disposable local Postgres for development/verification — NO Docker, no
 * system install. Downloads real PostgreSQL binaries via `embedded-postgres`,
 * boots them as a child process, applies prisma/sql/0001_init.sql, and stays
 * alive until Ctrl+C / SIGTERM.
 *
 * Data dir lives in the OS temp folder (NOT in OneDrive — sync corrupts
 * live database files) and is wiped on every start: this DB is a throwaway.
 *
 * Usage: node scripts/local-db.mjs [port]   (default 5433)
 * Connection string it prints:
 *   postgresql://postgres:localdev@127.0.0.1:<port>/yewogen?schema=yewogen
 */
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.argv[2] ?? 5433);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = mkdtempSync(join(tmpdir(), "yewogen-pg-"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "localdev",
  port: PORT,
  persistent: false, // stop() wipes the cluster — throwaway by design
});

async function main() {
  console.log(`[local-db] initialising cluster in ${dataDir} ...`);
  await pg.initialise();
  await pg.start();

  // Create the database as UTF8 explicitly, rather than pg.createDatabase(),
  // which inherits the cluster's locale. initdb takes that locale from Windows
  // — here "English_South Africa.1252" — and the resulting WIN1252 database
  // rejects the migrations outright: they carry box-drawing characters and
  // Amharic in their comments, and 0001 failed on the first "═" it met.
  // TEMPLATE template0 is required to change encoding away from the template's.
  const admin = pg.getPgClient();
  await admin.connect();
  await admin.query(
    `CREATE DATABASE yewogen ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`
  );
  await admin.end();

  const client = pg.getPgClient("yewogen");
  await client.connect();

  // Apply EVERY migration in order, not just the core one. This used to load
  // 0001 alone, which quietly left the dev database seventeen migrations behind
  // the real one — code that queried anything added later failed locally in a
  // way that looked like a bug in the code rather than a missing table.
  //
  // The `_yd_` in the pattern is what skips 0002-0007_combined_paste-into-
  // supabase.sql: that file is a convenience bundle for pasting into the
  // Supabase console and re-applies migrations already in this list.
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_yd_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      console.log(`[local-db] applied ${file}`);
    } catch (err) {
      console.error(`[local-db] FAILED on ${file}:`, err.message);
      throw err;
    }
  }
  await client.end();

  const url = `postgresql://postgres:localdev@127.0.0.1:${PORT}/yewogen`;
  console.log(`[local-db] ready — yd_ tables created in public schema`);
  console.log(`[local-db] DATABASE_URL=${url}`);
  console.log(`[local-db] press Ctrl+C to stop (data is discarded)`);

  const stop = async () => {
    console.log("\n[local-db] stopping ...");
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // keep the event loop alive
  setInterval(() => {}, 1 << 30);
}

main().catch(async (err) => {
  console.error("[local-db] failed:", err);
  try {
    await pg.stop();
  } catch {}
  process.exit(1);
});
