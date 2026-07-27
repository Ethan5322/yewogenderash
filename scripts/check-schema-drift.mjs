/**
 * Confirm the live database has every column/table the app code expects, so you
 * know whether any supabase/migrations/*.sql still needs to be applied.
 *
 *   node scripts/check-schema-drift.mjs .env
 *
 * Prints one line per checked object and exits non-zero if anything is missing.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const envPath = process.argv[2] ?? ".env";
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

// Each migration's headline objects, so a missing one names the file to apply.
const EXPECTED = [
  ["0002", "yd_fee_ledger", null],
  ["0002", "yd_campaign_balances", null],
  ["0002", "yd_payout_accounts", null],
  ["0002", "yd_blog_posts", null],
  ["0003", "yd_campaign_owners", "idPhotoUrl"],
  ["0004", "yd_messages", null],
  ["0005", "yd_users", "adminCode"],
  ["0006", "yd_campaign_owners", "faceDescriptor"],
  ["0007", "yd_campaign_owners", "faceMatched"],
  ["0008", "yd_campaign_documents", null],
  ["0009", "yd_campaigns", "flagged"],
  ["0010", "yd_campaign_owners", "livenessPassed"],
  ["0011", "yd_support_messages", null],
  ["0012", "yd_platform_settings", null],
  ["0013", "yd_platform_settings", "minPayoutEtb"],
  ["0014", "yd_users", "idPhotoUrl"],
  ["0014", "yd_users", "faceDescriptor"],
  ["0014", "yd_users", "biometricEnrolledAt"],
  ["0015", "yd_campaigns", "queryCodeActive"],
  ["0016", "yd_support_messages", "assignedToId"],
];

const client = new pg.Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL });
await client.connect();

const { rows: tables } = await client.query(
  `select table_name from information_schema.tables where table_schema = 'public'`
);
const tableSet = new Set(tables.map((r) => r.table_name));

const { rows: cols } = await client.query(
  `select table_name, column_name from information_schema.columns where table_schema = 'public'`
);
const colSet = new Set(cols.map((r) => `${r.table_name}.${r.column_name}`));

let missing = 0;
for (const [migration, table, column] of EXPECTED) {
  const label = column ? `${table}.${column}` : table;
  const present = column ? colSet.has(`${table}.${column}`) : tableSet.has(table);
  if (!present) missing++;
  console.log(`  ${present ? "ok     " : "MISSING"} ${label.padEnd(38)} (migration ${migration})`);
}

console.log(
  missing === 0
    ? "\nLive schema matches the code — nothing to apply.\n"
    : `\n${missing} object(s) missing — apply the migration(s) named above.\n`
);
await client.end();
process.exit(missing === 0 ? 0 : 1);
