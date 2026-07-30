-- Yewogen Derash — additive migration 0021
-- Somewhere to record what the BANK did, as opposed to what an admin says.
--
-- Today `status = PAID` means "an admin typed a reference and ticked a box".
-- Nothing in the system has ever spoken to Chapa about a transfer, so there is
-- no way to tell a typo from a real payment, and no way to answer "did this
-- fundraiser actually receive their money?" except by asking them.
--
-- These columns are deliberately SEPARATE from yd_payouts.status. That column is
-- the business state (requested / approved / paid / rejected); these are the
-- payment-provider state. Collapsing the two into one column leaves you unable
-- to answer either question when they disagree — and the whole point of
-- reconciliation is the case where they disagree.
--
-- No behaviour changes with this migration. CHAPA_TRANSFERS_ENABLED defaults to
-- off, so nothing can move money until it is deliberately switched on.
--
-- SAFE ON THE SHARED PROJECT: only yd_payouts and yd_platform_settings are
-- touched, and only by adding columns.

ALTER TABLE "yd_payouts"
  -- OUR reference, generated once per payout and written BEFORE Chapa is called.
  -- Chapa accepts a merchant `reference` and it is what their verify endpoint
  -- looks up, which makes it the idempotency key: as long as we never generate a
  -- second one for the same payout, we can always ask "did this already happen?"
  -- instead of guessing. A crash mid-flight therefore leaves evidence.
  ADD COLUMN IF NOT EXISTS "transferReference" TEXT,
  -- null = never attempted. PENDING = attempted, outcome NOT yet known — this is
  -- the state that must never be retried automatically. SUCCESS / FAILED are
  -- confirmed answers from Chapa, never inferred from a timeout.
  ADD COLUMN IF NOT EXISTS "transferStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "transferAttemptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transferFailureReason" TEXT,
  -- Chapa's own handle for the transfer, when their response gives us one.
  ADD COLUMN IF NOT EXISTS "chapaTransferId" TEXT,
  -- Raw provider response, kept verbatim. Their verify response shape is not
  -- fully documented, so when a transfer is disputed the untouched payload is
  -- the only thing that settles it.
  ADD COLUMN IF NOT EXISTS "transferResponse" JSONB;

-- One transfer reference, ever, per payout. The same lesson as migration 0020:
-- this codebase has already lost a race between "check if it exists" and
-- "insert it", and here that race would pay a real person twice.
CREATE UNIQUE INDEX IF NOT EXISTS "yd_payouts_transfer_reference_key"
  ON "yd_payouts" ("transferReference")
  WHERE "transferReference" IS NOT NULL;

-- Finding PENDING transfers to reconcile is the job that runs on a schedule.
CREATE INDEX IF NOT EXISTS "yd_payouts_transfer_status_idx"
  ON "yd_payouts" ("transferStatus", "transferAttemptedAt");

-- The ceiling above which a transfer is NOT sent from the app and must be done
-- by hand, as today. A cap means a bug in the send path costs the cap rather
-- than a campaign's whole balance. Editable by the main admin in Fees/Settings.
ALTER TABLE "yd_platform_settings"
  ADD COLUMN IF NOT EXISTS "maxAutoTransferEtb" INTEGER NOT NULL DEFAULT 25000;
