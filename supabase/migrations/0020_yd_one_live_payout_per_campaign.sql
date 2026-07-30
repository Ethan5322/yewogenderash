-- Yewogen Derash — additive migration 0020
-- Let the DATABASE enforce one live withdrawal per campaign.
--
-- WHY THIS EXISTS
--   requestPayoutAction checks "does this campaign already have a payout?" and
--   then creates one. Those are two statements, not one, so two clicks — or two
--   browser tabs, or a double-submit on a slow connection — can both pass the
--   check before either row is written. The result is two payouts for the full
--   balance against a balance that only covers one. A campaign paid twice.
--
--   Application code cannot close that window; only the database can. This
--   index makes the second insert fail rather than succeed, whatever the timing.
--
--   REJECTED and CANCELLED are excluded on purpose: a rejected request must not
--   occupy the slot, or one admin decision would permanently lock a fundraiser
--   out of their own funds.
--
-- SAFE ON THE SHARED PROJECT: only yd_payouts is touched, and only by adding an
-- index. No data is changed.
--
-- NOTE ON PRISMA: partial unique indexes (the WHERE clause) cannot be expressed
-- in schema.prisma, so this constraint lives in SQL only. It is documented on
-- the Payout model so the difference is deliberate and visible rather than
-- another silent drift between the schema and the database.

-- ── Guard ─────────────────────────────────────────────────────────────────
-- CREATE UNIQUE INDEX fails with a bare "could not create unique index" if any
-- campaign already has two live payouts — which is possible on historical data,
-- because instalment withdrawals used to be allowed. This block fails FIRST
-- with a message that says which campaigns to fix and how.
DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT "campaignId", ', ')
    INTO offenders
    FROM (
      SELECT "campaignId"
        FROM "yd_payouts"
       WHERE "status" IN ('REQUESTED', 'APPROVED', 'PAID')
       GROUP BY "campaignId"
      HAVING COUNT(*) > 1
    ) dupes;

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add the one-live-payout rule: these campaigns already have more than one live payout: %. These are historical instalment withdrawals from before the one-withdrawal rule. Review them in Admin -> Payouts and set the superseded ones to CANCELLED, then run this migration again. Nothing has been changed.',
      offenders;
  END IF;
END $$;

-- ── The constraint ────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "yd_payouts_one_live_per_campaign"
  ON "yd_payouts" ("campaignId")
  WHERE "status" IN ('REQUESTED', 'APPROVED', 'PAID');
