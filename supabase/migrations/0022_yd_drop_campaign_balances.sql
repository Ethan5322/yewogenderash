-- Yewogen Derash — migration 0022
-- Remove yd_campaign_balances, a balance table that nothing read and that lied.
--
-- WHY
--   It was incremented when a donation settled and decremented on a refund, but
--   NOTHING adjusted it when a payout was made, and "totalWithdrawn" was never
--   written at all. So after a fundraiser withdrew their whole balance, this
--   table still reported the entire net as available — 2,910 against a true 0 in
--   the test that found it.
--
--   Nobody ever saw that, because nothing read the table. Three separate
--   comments in the code already said "computed from the ledger, not the
--   CampaignBalance denorm, so it stays correct even if it drifts". It had been
--   superseded and deliberately routed around, and then left in place.
--
--   That is what makes it worth deleting rather than leaving alone: a table of
--   money numbers that everything distrusts, sitting in the database, waiting for
--   the next person to write a dashboard against it and offer funds that have
--   already gone.
--
-- WHAT REPLACES IT
--   campaignAvailableBalance() in lib/payouts.ts — successful donations minus
--   reserved payouts, computed on read. Two indexed aggregates instead of one
--   lookup, and it cannot disagree with itself.
--
-- NOTHING IS LOST
--   Every column was derivable from tables that remain:
--     grossRaised     = SUM(yd_donations.amount)     WHERE status='SUCCESS'
--     totalFees       = SUM(yd_donations.platformFee) WHERE status='SUCCESS'
--     netRaised       = SUM(yd_donations.netAmount)   WHERE status='SUCCESS'
--     totalWithdrawn  = SUM(yd_payouts.amount) WHERE status IN
--                       ('REQUESTED','APPROVED','PAID')
--     availableAmount = netRaised − totalWithdrawn
--   The query at the bottom of this file prints those figures per campaign from
--   the source ledgers, so the numbers can be read back before and after.
--
-- SAFE ON THE SHARED PROJECT: only the yd_-prefixed yd_campaign_balances table
-- is dropped. No other table is touched and no other project is affected.
--
-- IRREVERSIBLE: this is a DROP. The values are recomputable from the ledgers as
-- shown above, but the table itself will be gone.

-- ── What the ledgers say, from source. Run this FIRST if you want a record. ──
-- Kept above the DROP deliberately: it reads only yd_donations and yd_payouts, so
-- it works identically before and after this migration.
SELECT
  c."id"    AS campaign_id,
  c."title" AS campaign,
  COALESCE(d.gross, 0)                                    AS gross_raised,
  COALESCE(d.fees, 0)                                     AS total_fees,
  COALESCE(d.net, 0)                                      AS net_raised,
  COALESCE(p.reserved, 0)                                 AS total_withdrawn,
  COALESCE(d.net, 0) - COALESCE(p.reserved, 0)            AS available_amount
FROM "yd_campaigns" c
LEFT JOIN (
  SELECT "campaignId",
         SUM("amount")      AS gross,
         SUM("platformFee") AS fees,
         SUM("netAmount")   AS net
    FROM "yd_donations"
   WHERE "status" = 'SUCCESS'
   GROUP BY "campaignId"
) d ON d."campaignId" = c."id"
LEFT JOIN (
  SELECT "campaignId", SUM("amount") AS reserved
    FROM "yd_payouts"
   WHERE "status" IN ('REQUESTED', 'APPROVED', 'PAID')
   GROUP BY "campaignId"
) p ON p."campaignId" = c."id"
ORDER BY gross_raised DESC NULLS LAST;

-- ── The removal ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "yd_campaign_balances";

-- ── Verification: the row below must say OK ─────────────────────────────────
SELECT
  'yd_campaign_balances removed' AS check,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_name = 'yd_campaign_balances'
  ) THEN 'OK — one source of truth for balances'
    ELSE 'STILL PRESENT — the drop did not run' END AS result;
