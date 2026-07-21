// Dev helper: delete throwaway test signups so their email + phone can be
// re-used again and again while testing (before the site is public).
//
// Preserves the seeded admin/owner accounts and NEVER deletes an ADMIN.
//
//   node --env-file=.env scripts/reset-test-users.mjs            # clear all test signups
//   node --env-file=.env scripts/reset-test-users.mjs a@b.com    # clear specific email(s)
import pg from "pg";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL/DATABASE_URL missing — run with --env-file=.env");

// Accounts that must survive a reset (seed data + your admin login).
const KEEP = [
  "admin@yewogenderash.local",
  "kyc.admin@yewogenderash.local",
  "owner@demo.local",
  "mulukenendashaw68@gmail.com",
];

const args = process.argv.slice(2).map((s) => s.toLowerCase());
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

let rows;
try {
  if (args.length) {
    rows = await c.query(
      `DELETE FROM "yd_users" WHERE lower(email) = ANY($1) AND role <> 'ADMIN' RETURNING email`,
      [args]
    );
  } else {
    rows = await c.query(
      `DELETE FROM "yd_users" WHERE role <> 'ADMIN' AND lower(email) <> ALL($1) RETURNING email`,
      [KEEP]
    );
  }
  console.log(`Deleted ${rows.rowCount} test account(s): ${rows.rows.map((r) => r.email).join(", ") || "(none)"}`);
  console.log("You can now register again with those same email/phone values.");
} catch (err) {
  console.error("Could not delete (a test owner may have campaigns/payouts):", err.message);
} finally {
  await c.end();
}
