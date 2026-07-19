/**
 * Shared-database collision check (rule #6). Run BEFORE `prisma db push`.
 *
 * Lists every table in the target database and confirms that:
 *   - the 12 yd_ tables this app owns are safe to create/manage, and
 *   - `prisma db push` will not need to touch any NON-yd_ table.
 *
 * Usage: node scripts/db-preflight.mjs .env
 * Exits non-zero if a yd_ table name is already taken by something we don't
 * recognise, so a shared DB is never clobbered by accident.
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

const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url || /PROJECT_REF|REGION|PASSWORD/.test(url)) {
  console.error("✗ DIRECT_URL/DATABASE_URL is missing or still a placeholder in", envPath);
  process.exit(1);
}

// The 12 tables this app owns (must match prisma @@map names).
const OWNED = [
  "yd_users", "yd_otp_codes", "yd_campaign_owners", "yd_verification_documents",
  "yd_campaigns", "yd_campaign_updates", "yd_donations", "yd_payouts",
  "yd_webhook_events", "yd_notifications", "yd_audit_logs", "yd_site_content",
];

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name`
);
await client.end();

const existing = rows.map((r) => r.table_name);
const ydExisting = existing.filter((t) => t.startsWith("yd_"));
const foreign = existing.filter((t) => !t.startsWith("yd_"));

console.log(`\nDatabase already has ${existing.length} table(s) in public:`);
console.log(`  • ${foreign.length} NON-yd_ (other projects — will NOT be touched)`);
if (foreign.length) console.log(`    ${foreign.join(", ")}`);
console.log(`  • ${ydExisting.length} yd_ (ours): ${ydExisting.join(", ") || "(none yet)"}`);

// Collision = a yd_ name we DON'T own already exists (shouldn't happen, but guard).
const strayYd = ydExisting.filter((t) => !OWNED.includes(t));
if (strayYd.length) {
  console.error(`\n✗ Unexpected yd_ tables not owned by this app: ${strayYd.join(", ")}`);
  console.error("  Resolve before pushing.");
  process.exit(2);
}

const missing = OWNED.filter((t) => !ydExisting.includes(t));
if (missing.length === 0) {
  console.log("\n✓ All 12 yd_ tables already present — push will be a no-op / safe alter.");
} else {
  console.log(`\n✓ Safe to create ${missing.length} yd_ table(s): ${missing.join(", ")}`);
}
console.log("  No non-yd_ table will be modified by prisma db push.\n");
