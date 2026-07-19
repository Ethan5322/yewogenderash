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
import { mkdtempSync, readFileSync } from "node:fs";
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
  await pg.createDatabase("yewogen");

  const client = pg.getPgClient("yewogen");
  await client.connect();
  const ddl = readFileSync(join(root, "prisma", "sql", "0001_init.sql"), "utf8");
  await client.query(ddl);
  await client.end();

  const url = `postgresql://postgres:localdev@127.0.0.1:${PORT}/yewogen?schema=yewogen`;
  console.log(`[local-db] ready — schema 'yewogen' created with full DDL`);
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
