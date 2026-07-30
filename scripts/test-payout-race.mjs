/**
 * Proves the database — not the application — stops a campaign being paid twice.
 *
 * requestPayoutAction checks for an existing payout and then inserts one. Those
 * are two statements, so two concurrent submits can both pass the check. No
 * amount of application code closes that window; only a constraint does.
 *
 * This fires genuinely simultaneous inserts and asserts exactly one survives.
 * A mock cannot test this: the thing under test IS the database.
 *
 * Usage:
 *   node scripts/local-db.mjs 5440          # in another shell
 *   DATABASE_URL=... node scripts/test-payout-race.mjs
 */
import { Client } from "pg";

const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error("Set DATABASE_URL (see scripts/local-db.mjs)");
  process.exit(1);
}

let checks = 0;
let failures = 0;
const ok = (cond, label, detail = "") => {
  checks++;
  if (cond) {
    console.log(`  pass  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const id = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

const client = new Client({ connectionString: URL });
await client.connect();

// ── Fixtures ───────────────────────────────────────────────────────────────
const userId = id("user");
const ownerId = id("owner");
const campaignId = id("camp");

await client.query(
  `INSERT INTO "yd_users" ("id","name","email","passwordHash","role","updatedAt")
   VALUES ($1,'Race Test',$2,'x','OWNER',now())`,
  [userId, `${userId}@test.local`]
);
await client.query(
  `INSERT INTO "yd_campaign_owners" ("id","userId","updatedAt")
   VALUES ($1,$2,now())`,
  [ownerId, userId]
);
// Column names taken from the migrated database, not guessed: the required set
// is id, ownerId, title, slug, description, category, targetAmount, queryCode.
await client.query(
  `INSERT INTO "yd_campaigns"
     ("id","ownerId","title","slug","description","category","targetAmount",
      "queryCode","status","updatedAt")
   VALUES ($1,$2,'Race test',$3,'desc','MEDICAL',1000,$4,'COMPLETED',now())`,
  [campaignId, ownerId, campaignId, id("QC").slice(0, 12)]
);

const insertPayout = (c) =>
  c.query(
    `INSERT INTO "yd_payouts" ("id","campaignId","ownerId","amount","status","updatedAt")
     VALUES ($1,$2,$3,970,'REQUESTED',now())`,
    [id("payout"), campaignId, ownerId]
  );

console.log("\n1. The index exists");
const idx = await client.query(
  `SELECT indexdef FROM pg_indexes
    WHERE tablename = 'yd_payouts' AND indexname = 'yd_payouts_one_live_per_campaign'`
);
ok(idx.rowCount === 1, "yd_payouts_one_live_per_campaign is present");
ok(
  /REQUESTED/.test(idx.rows[0]?.indexdef ?? "") &&
    !/REJECTED/.test(idx.rows[0]?.indexdef ?? ""),
  "it covers live states only, not REJECTED/CANCELLED"
);

console.log("\n2. Two SIMULTANEOUS withdrawals — one must lose");
// Two connections, both inside a transaction, both inserting the same campaign
// before either commits. This is the double-click, faithfully reproduced.
//
// The ordering below matters and an earlier version of this test deadlocked on
// it: Postgres makes B's insert WAIT on A's uncommitted row rather than failing
// straight away, so awaiting both inserts before committing A hangs forever.
// A must be committed while B's insert is still in flight — only then does B
// learn it lost.
const a = new Client({ connectionString: URL });
const b = new Client({ connectionString: URL });
await a.connect();
await b.connect();
await a.query("BEGIN");
await b.query("BEGIN");

await insertPayout(a); // wins, and holds the lock
const bInsert = insertPayout(b); // starts, then blocks — deliberately not awaited
const bOutcome = bInsert.then(
  () => ({ status: "fulfilled" }),
  (reason) => ({ status: "rejected", reason })
);

await a.query("COMMIT"); // release the lock; B can now be judged
const bResult = await bOutcome;
await b.query("ROLLBACK").catch(() => {});
await a.end();
await b.end();

const live = await client.query(
  `SELECT COUNT(*)::int AS n FROM "yd_payouts"
    WHERE "campaignId" = $1 AND "status" IN ('REQUESTED','APPROVED','PAID')`,
  [campaignId]
);
ok(live.rows[0].n === 1, "exactly one live payout survived", `got ${live.rows[0].n}`);
ok(bResult.status === "rejected", "the second insert was refused, not queued");
ok(
  /unique|duplicate key/i.test(String(bResult.reason?.message ?? "")),
  "refusal is a unique-constraint violation",
  String(bResult.reason?.message ?? "")
);
// The app maps this to a friendly message; confirm the code it matches on.
ok(
  bResult.reason?.code === "23505",
  "SQLSTATE is 23505, which isUniqueViolation() matches",
  String(bResult.reason?.code)
);

console.log("\n3. A rejected payout frees the slot");
await client.query(
  `UPDATE "yd_payouts" SET "status" = 'REJECTED' WHERE "campaignId" = $1`,
  [campaignId]
);
let reReq = "threw";
try {
  await insertPayout(client);
  reReq = "allowed";
} catch (e) {
  reReq = `blocked: ${e.message}`;
}
ok(reReq === "allowed", "can request again after a rejection", reReq);

console.log("\n4. But not twice again");
let second = "allowed";
try {
  await insertPayout(client);
} catch (e) {
  second = e.code === "23505" ? "blocked" : `unexpected: ${e.message}`;
}
ok(second === "blocked", "the slot is occupied again", second);

// ── Cleanup ────────────────────────────────────────────────────────────────
await client.query(`DELETE FROM "yd_payouts" WHERE "campaignId" = $1`, [campaignId]);
await client.query(`DELETE FROM "yd_campaigns" WHERE "id" = $1`, [campaignId]);
await client.query(`DELETE FROM "yd_campaign_owners" WHERE "id" = $1`, [ownerId]);
await client.query(`DELETE FROM "yd_users" WHERE "id" = $1`, [userId]);
await client.end();

console.log(`\n${checks} checks, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
