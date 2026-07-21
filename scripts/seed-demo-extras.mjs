// Dev helper: make the corporate-round features testable with real data.
// Idempotent — re-runnable. Seeds:
//   1. Fee split backfill on every SUCCESS donation (platformFee/netAmount/feeRate)
//   2. yd_fee_ledger rows for those donations
//   3. yd_campaign_balances recomputed from ledger + payouts
//   4. A verified payout account (demo Chapa subaccount) for the demo owner
//   5. A prior PAID payout so the owner's next small request AUTO-APPROVES
//   6. Two published blog posts
//
// Run: node --env-file=.env scripts/seed-demo-extras.mjs
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL/DATABASE_URL missing — run with --env-file=.env");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// ── 1. Fee split backfill on confirmed donations (3%) ──────────────
await c.query(`
  UPDATE "yd_donations" SET
    "platformFee" = round(amount * 0.03, 2),
    "netAmount"   = amount - round(amount * 0.03, 2),
    "feeRate"     = 0.03
  WHERE status = 'SUCCESS'
`);

// ── 2. Fee ledger: one row per SUCCESS donation, not already present ─
const ledger = await c.query(`
  INSERT INTO "yd_fee_ledger"
    (id,"donationId","campaignId","grossAmount","feeAmount","netAmount","feeRate",currency,"createdAt")
  SELECT gen_random_uuid()::text, d.id, d."campaignId", d.amount, d."platformFee",
         d."netAmount", d."feeRate", d.currency, coalesce(d."paidAt", now())
  FROM "yd_donations" d
  WHERE d.status = 'SUCCESS'
    AND NOT EXISTS (SELECT 1 FROM "yd_fee_ledger" f WHERE f."donationId" = d.id)
  RETURNING id
`);
console.log(`Fee ledger: +${ledger.rowCount} rows`);

// ── 4. Verified payout account for the demo owner ───────────────────
const ownerRes = await c.query(`
  SELECT o.id AS owner_id, u.name
  FROM "yd_campaign_owners" o
  JOIN "yd_users" u ON u.id = o."userId"
  WHERE u.email = 'owner@demo.local'
`);
if (ownerRes.rowCount === 0) {
  console.log("Demo owner not found — run `node --env-file=.env prisma/seed.ts` first.");
  await c.end();
  process.exit(0);
}
const ownerId = ownerRes.rows[0].owner_id;

// Replace any prior demo account so this stays idempotent.
await c.query(`DELETE FROM "yd_payout_accounts" WHERE "ownerId"=$1 AND "chapaSubaccountId" LIKE 'DEMO-%'`, [ownerId]);
await c.query(`UPDATE "yd_payout_accounts" SET "isDefault"=false WHERE "ownerId"=$1`, [ownerId]);
await c.query(
  `INSERT INTO "yd_payout_accounts"
     (id,"ownerId","accountName","bankName","bankCode","accountNumber","chapaSubaccountId",
      "isVerified","verifiedAt","isDefault","createdAt","updatedAt")
   VALUES ($1,$2,'Abebe Kebede','Commercial Bank of Ethiopia','946','1000123456789',$3,true,now(),true,now(),now())`,
  [randomUUID(), ownerId, `DEMO-${randomUUID().slice(0, 8)}`]
);
console.log("Payout account: verified demo account added");

// ── 5. A prior PAID payout so the next small request auto-approves ──
const selam = await c.query(`SELECT id FROM "yd_campaigns" WHERE "queryCode"='SELAM01'`);
if (selam.rowCount > 0) {
  const campId = selam.rows[0].id;
  await c.query(`DELETE FROM "yd_payouts" WHERE "payoutReference" LIKE 'DEMO-%'`);
  await c.query(
    `INSERT INTO "yd_payouts"
       (id,"campaignId","ownerId",amount,currency,status,"payoutReference","approvedByAdminId",
        "approvedAt","paidAt","autoApproved","reviewReason","createdAt","updatedAt")
     VALUES ($1,$2,$3,1000,'ETB','PAID','DEMO-REF-001',NULL,now(),now(),false,
             'Seeded prior payout (establishes track record)',now(),now())`,
    [randomUUID(), campId, ownerId]
  );
  console.log("Prior payout: 1 PAID payout seeded (enables auto-approval)");
}

// ── 3. Recompute campaign balances from ledger + payouts ────────────
await c.query(`
  INSERT INTO "yd_campaign_balances"
    (id,"campaignId","grossRaised","totalFees","netRaised","totalWithdrawn","availableAmount",currency,"updatedAt")
  SELECT gen_random_uuid()::text, c.id,
         coalesce(fl.gross,0), coalesce(fl.fees,0), coalesce(fl.net,0),
         coalesce(po.withdrawn,0),
         coalesce(fl.net,0) - coalesce(po.withdrawn,0),
         'ETB', now()
  FROM "yd_campaigns" c
  JOIN (SELECT "campaignId", sum("grossAmount") gross, sum("feeAmount") fees, sum("netAmount") net
        FROM "yd_fee_ledger" GROUP BY "campaignId") fl ON fl."campaignId" = c.id
  LEFT JOIN (SELECT "campaignId", sum(amount) withdrawn FROM "yd_payouts"
             WHERE status IN ('REQUESTED','APPROVED','PAID') GROUP BY "campaignId") po ON po."campaignId" = c.id
  ON CONFLICT ("campaignId") DO UPDATE SET
    "grossRaised"    = EXCLUDED."grossRaised",
    "totalFees"      = EXCLUDED."totalFees",
    "netRaised"      = EXCLUDED."netRaised",
    "totalWithdrawn" = EXCLUDED."totalWithdrawn",
    "availableAmount"= EXCLUDED."availableAmount",
    "updatedAt"      = now()
`);
console.log("Campaign balances: recomputed");

// ── 6. Published blog posts ─────────────────────────────────────────
const adminRes = await c.query(`SELECT id FROM "yd_users" WHERE role='ADMIN' ORDER BY "createdAt" LIMIT 1`);
const adminId = adminRes.rows[0]?.id ?? null;
const POSTS = [
  {
    slug: "how-verification-protects-donors",
    title: "How verification protects every donor",
    excerpt:
      "Every campaign owner on Yewogen Derash passes identity and document checks before a single birr is raised. Here is exactly how it works.",
    body: `Trust is the foundation of giving. Before any campaign goes live on Yewogen Derash, its owner completes a strict verification process.\n\nFirst, we confirm the owner's identity with a government ID and a live face capture. Then our team reviews supporting documents specific to the campaign — a hospital letter for a medical case, a school letter for education, and so on.\n\nOnly after this review does a campaign receive the Mulesoo verification seal and become visible to donors. You can always see an owner's verification status and code on their public author profile.`,
  },
  {
    slug: "where-your-donation-goes",
    title: "Where your donation goes: fees, splits, and payouts",
    excerpt:
      "A transparent look at the 3% platform fee, how funds stay separated per campaign, and how verified owners receive their money.",
    body: `We believe you deserve to know exactly where your money goes.\n\nWhen you donate, a flat 3% platform fee keeps Yewogen Derash running — verification, security, and support. The remaining 97% is credited to that specific campaign, and to no other. Funds are never pooled across campaigns.\n\nCampaign owners can only withdraw their net balance to a verified bank account, and every payout is reviewed and recorded. This is how we keep giving safe, separated, and auditable.`,
  },
];
for (const p of POSTS) {
  await c.query(`DELETE FROM "yd_blog_posts" WHERE slug=$1`, [p.slug]);
  await c.query(
    `INSERT INTO "yd_blog_posts"
       (id,slug,title,excerpt,body,status,"authorId","publishedAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'PUBLISHED',$6,now(),now(),now())`,
    [randomUUID(), p.slug, p.title, p.excerpt, p.body, adminId]
  );
}
console.log(`Blog: ${POSTS.length} published posts`);

await c.end();
console.log("\nDone. Demo data ready for testing.");
