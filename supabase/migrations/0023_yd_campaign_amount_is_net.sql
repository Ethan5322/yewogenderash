-- Yewogen Derash — migration 0023
-- Restate yd_campaigns.currentAmount as NET (what the campaign receives) instead
-- of GROSS (what donors paid).
--
-- WHY
--   A fundraiser's account should read the money they will actually get, without
--   a fee breakdown on every screen: a 100 birr donation shows as 97, ten of them
--   as 970. The owner also chose to apply the same figure to the public campaign
--   page, so one number means one thing everywhere.
--
--   Decided at the WRITE site (lib/donations.ts) rather than converted on read,
--   because currentAmount is read in 46 places — public campaign pages, goal
--   progress, admin lists, analytics, SEO metadata, sort order. Netting it at
--   each of those means every future read has to remember, and the one that
--   forgets displays a different total from the rest. That is precisely the
--   defect that migration 0022 removed.
--
-- GROSS IS NOT LOST
--   It stays on every donation row as yd_donations.amount, which is what the fee
--   ledger records and what the 7% withholding is still calculated from. The main
--   admin's screens continue to show gross, fee and net in full.
--
-- WHAT THIS DOES TO EXISTING DATA
--   Recomputes currentAmount for every campaign from its settled donations. Any
--   campaign with no successful donations becomes 0, which is what it should
--   already have been.
--
--   COALESCE("netAmount", "amount") handles legacy rows: donations settled before
--   the fee ledger existed have no netAmount, and for those the gross is the best
--   figure available. They are counted at gross rather than dropped — a donation
--   silently vanishing from a campaign total would be far worse than one being
--   3% high.
--
-- SAFE ON THE SHARED PROJECT: only yd_campaigns.currentAmount is written, and
-- only from yd_donations. No schema change, no other table touched.
--
-- REVERSIBLE: re-run with SUM("amount") instead of SUM(COALESCE(...)) to restore
-- gross. Nothing is destroyed — this recomputes a derived total.

-- ── Before: what each campaign currently claims vs what net actually is ──────
-- Run this first if you want to see the change coming. Read-only.
SELECT
  c."id"            AS campaign_id,
  c."title"         AS campaign,
  c."currentAmount" AS shown_now_gross,
  COALESCE(d.net, 0) AS will_show_net,
  c."currentAmount" - COALESCE(d.net, 0) AS difference
FROM "yd_campaigns" c
LEFT JOIN (
  SELECT "campaignId", SUM(COALESCE("netAmount", "amount")) AS net
    FROM "yd_donations"
   WHERE "status" = 'SUCCESS'
   GROUP BY "campaignId"
) d ON d."campaignId" = c."id"
WHERE c."currentAmount" <> COALESCE(d.net, 0)
ORDER BY difference DESC;

-- ── The restatement ─────────────────────────────────────────────────────────
UPDATE "yd_campaigns" c
   SET "currentAmount" = COALESCE((
         SELECT SUM(COALESCE(dn."netAmount", dn."amount"))
           FROM "yd_donations" dn
          WHERE dn."campaignId" = c."id"
            AND dn."status" = 'SUCCESS'
       ), 0);

-- ── Verification: every campaign must now agree with its donations ──────────
SELECT
  'currentAmount equals net donated' AS check,
  CASE WHEN NOT EXISTS (
    SELECT 1
      FROM "yd_campaigns" c
      LEFT JOIN (
        SELECT "campaignId", SUM(COALESCE("netAmount", "amount")) AS net
          FROM "yd_donations"
         WHERE "status" = 'SUCCESS'
         GROUP BY "campaignId"
      ) d ON d."campaignId" = c."id"
     WHERE c."currentAmount" <> COALESCE(d.net, 0)
  ) THEN 'OK — every campaign total is the net it received'
    ELSE 'MISMATCH — at least one campaign disagrees with its donations' END AS result;
