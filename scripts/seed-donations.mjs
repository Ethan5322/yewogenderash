// Dev helper: populate realistic sample donations on the demo campaigns so the
// owner ledger, progress bars, and admin analytics show real numbers.
// Idempotent — it removes its own previous rows (txRef 'SEED-%') first, then
// recomputes each campaign's currentAmount from confirmed donations.
// Run: node --env-file=.env scripts/seed-donations.mjs
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL/DATABASE_URL missing — run with --env-file=.env");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const DONORS = [
  "Aster Bekele", "Dawit Girma", "Hanna Tesfaye", "Yonas Alemu", "Meron Haile",
  "Samuel Tadesse", "Liya Mekonnen", "Robel Assefa", "Saron Desta", "Nahom Kebede",
  "Bethlehem Getachew", "Kaleb Wolde", "Marta Solomon", "Eyob Fikru", null, null,
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

// queryCode -> how many sample donations
const TARGETS = { SELAM01: 22, LIBRARY1: 16 };

const camps = await c.query(
  `select id, "queryCode" from "yd_campaigns" where "queryCode" = ANY($1)`,
  [Object.keys(TARGETS)]
);
if (camps.rowCount === 0) {
  console.log("No demo campaigns found — run the main seed first.");
  await c.end();
  process.exit(0);
}

for (const camp of camps.rows) {
  await c.query(`delete from "yd_donations" where "campaignId"=$1 and "txRef" like 'SEED-%'`, [camp.id]);

  const n = TARGETS[camp.queryCode] ?? 10;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const amount = pick([100, 200, 250, 500, 500, 1000, 1000, 2000, 3000, 5000]);
    const daysAgo = rand(0, 29);
    const paidAt = new Date(now - daysAgo * 86400000 - rand(0, 86399) * 1000);
    await c.query(
      `insert into "yd_donations"
        (id,"campaignId","donorName",amount,currency,"txRef",status,"paidAt","createdAt","updatedAt")
       values ($1,$2,$3,$4,'ETB',$5,'SUCCESS',$6,$6,now())`,
      [randomUUID(), camp.id, pick(DONORS), amount, `SEED-${randomUUID()}`, paidAt]
    );
  }

  // currentAmount = sum of ALL confirmed donations (seed + any real).
  const res = await c.query(
    `update "yd_campaigns" set "currentAmount" =
       (select coalesce(sum(amount),0) from "yd_donations" where "campaignId"=$1 and status='SUCCESS')
     where id=$1 returning "currentAmount"`,
    [camp.id]
  );
  console.log(`${camp.queryCode}: ${n} donations, raised ETB ${res.rows[0].currentAmount}`);
}

await c.end();
console.log("Done.");
